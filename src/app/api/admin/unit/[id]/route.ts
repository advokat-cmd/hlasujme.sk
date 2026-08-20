import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { UnitType, CoMode, OwnerRole } from "@prisma/client";
import { createAuditLogEntryWithTx } from "@/lib/hashChain";
import * as argon2 from "argon2";
import { validateNewPassword, validateOptionalEmail, validateOwners, type NormalizedOwner } from "@/lib/security/input";
import { assertAccountMutationAllowed, assertLinkedAccountDeletionAllowed, requestedLinkedAccountRole } from "@/lib/security/accounts";
import { didLoginEmailChange, synchronizeSingleOwnerEmail } from "@/lib/unitEmails";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session || session.role === "vlastnik") {
      return NextResponse.json({ error: "Nedostatočné oprávnenia." }, { status: 403 });
    }

    const { id: unitId } = await params;
    const body = await request.json();
    const { no, type, floor, email, coMode } = body as {
      no: string;
      type: "byt" | "nebyt";
      floor: string;
      email: string;
      coMode: string;
    };

    const existingUnit = await db.unit.findUnique({
      where: { id: unitId },
      include: { owners: { include: { admins: true } } }
    });

    if (!existingUnit) {
      return NextResponse.json({ error: "Jednotka nebola nájdená." }, { status: 404 });
    }

    let owners: NormalizedOwner[];
    let unitEmail: string;
    try {
      unitEmail = validateOptionalEmail(email, "E-mail jednotky");
      owners = validateOwners(body.owners, coMode);
      const synchronized = synchronizeSingleOwnerEmail(coMode, unitEmail, owners);
      unitEmail = synchronized.unitEmail;
      owners = synchronized.owners;
      for (const owner of owners) {
        const ownerAccount = owner.id ? await db.admin.findFirst({ where: { ownerId: owner.id } }) : null;
        const emailAccount = owner.email ? await db.admin.findUnique({ where: { email: owner.email } }) : null;
        if (emailAccount && emailAccount.ownerId !== owner.id) {
          return NextResponse.json({ error: `E-mail ${owner.email} už používa iný účet.` }, { status: 409 });
        }
        if (ownerAccount || owner.admin || owner.password) {
          const role = requestedLinkedAccountRole(ownerAccount, owner.admin);
          assertAccountMutationAllowed(session, ownerAccount, role);
          if (!ownerAccount && !owner.password) throw new Error("Nový prihlasovací účet vyžaduje bezpečné heslo.");
          if (owner.password) validateNewPassword(owner.password);
        }
      }
      const payloadOwnerIds = new Set(owners.map((owner) => owner.id).filter(Boolean));
      for (const omittedOwner of existingUnit.owners.filter((owner) => !payloadOwnerIds.has(owner.id))) {
        assertLinkedAccountDeletionAllowed(session, omittedOwner.admins);
      }
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Neplatné údaje vlastníkov." }, { status: 400 });
    }

    // Check duplicate
    if (no.trim() !== existingUnit.no) {
      const duplicate = await db.unit.findFirst({
        where: { buildingId: existingUnit.buildingId, no: no.trim() },
      });
      if (duplicate) {
        return NextResponse.json({ error: `Jednotka s číslom ${no} už existuje.` }, { status: 400 });
      }
    }

    const passwordHashes = await Promise.all(owners.map((owner) =>
      owner.password
        ? argon2.hash(validateNewPassword(owner.password), { type: argon2.argon2id })
        : Promise.resolve(undefined),
    ));

    // Perform database transaction for unit update + owners sync
    const updatedUnit = await db.$transaction(async (tx) => {
      const currentUnit = await tx.unit.findUnique({
        where: { id: unitId },
        include: { owners: { include: { admins: true } } },
      });
      if (!currentUnit) throw new Error("Jednotka bola počas úpravy odstránená.");

      const payloadOwnerIds = new Set(owners.map((owner) => owner.id).filter(Boolean));
      const ownersToDelete = currentUnit.owners.filter((owner) => !payloadOwnerIds.has(owner.id));
      for (const owner of ownersToDelete) {
        assertLinkedAccountDeletionAllowed(session, owner.admins);
      }

      for (const owner of owners) {
        const currentOwner = owner.id ? currentUnit.owners.find((candidate) => candidate.id === owner.id) : undefined;
        if (currentOwner && currentOwner.admins.length > 1) {
          throw new Error("Vlastník má nejednoznačne priradené prihlasovacie účty.");
        }
        const existingAdmin = currentOwner?.admins[0] ?? null;
        const emailAccount = owner.email ? await tx.admin.findUnique({ where: { email: owner.email } }) : null;
        if (emailAccount && emailAccount.ownerId !== currentOwner?.id) {
          throw new Error(`E-mail ${owner.email} už používa iný účet.`);
        }
        if (existingAdmin || owner.admin || owner.password) {
          const role = requestedLinkedAccountRole(existingAdmin, owner.admin);
          assertAccountMutationAllowed(session, existingAdmin, role);
          if (!existingAdmin && !owner.password) throw new Error("Nový prihlasovací účet vyžaduje bezpečné heslo.");
        }
      }

      // 1. Update Unit
      const unit = await tx.unit.update({
        where: { id: unitId },
        data: {
          no: no.trim(),
          type: type === "nebyt" ? UnitType.nebyt : UnitType.byt,
          floor: floor.trim(),
          coMode: coMode as CoMode,
          email: unitEmail || null
        }
      });

      // 2. Sync owners
      // Delete old owners no longer in payload
      let revokedSessions = 0;
      let deletedLinkedAccounts = 0;
      let loginEmailChanges = 0;
      for (const owner of ownersToDelete) {
        for (const account of owner.admins) {
          const revoked = await tx.adminSession.updateMany({
            where: { adminId: account.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          revokedSessions += revoked.count;
          await tx.admin.delete({ where: { id: account.id } });
          deletedLinkedAccounts++;
        }
        await tx.owner.delete({ where: { id: owner.id } });
      }

      const updatedOwners = [];

      for (let ownerIndex = 0; ownerIndex < owners.length; ownerIndex++) {
        const o = owners[ownerIndex];
        const ownerName = `${o.first} ${o.last}`;
        const ownerEmail = o.email || null;
        const currentOwner = o.id ? currentUnit.owners.find((owner) => owner.id === o.id) : undefined;
        
        let dbOwner;
        if (currentOwner) {
          // Update existing
          dbOwner = await tx.owner.update({
            where: { id: o.id },
            data: {
              first: o.first,
              last: o.last,
              name: ownerName,
              email: ownerEmail,
              phone: o.phone || null,
              birthDate: o.birthDate || null,
              share: o.share,
              role: o.role as OwnerRole
            }
          });
        } else {
          // Create new
          dbOwner = await tx.owner.create({
            data: {
              unitId,
              first: o.first,
              last: o.last,
              name: ownerName,
              email: ownerEmail,
              phone: o.phone || null,
              birthDate: o.birthDate || null,
              share: o.share,
              role: o.role as OwnerRole
            }
          });
        }

        updatedOwners.push(dbOwner);

        // Check if there is an existing Admin record for this owner
        const existingAdmin = currentOwner?.admins[0] ?? null;

        const loginEmail = o.email;
        
        if (loginEmail && (o.admin || o.password || existingAdmin)) {
          // Determine the role
          const role = requestedLinkedAccountRole(existingAdmin, o.admin);

          const passwordHash = passwordHashes[ownerIndex];
          const adminData = {
            name: ownerName,
            email: loginEmail,
            unitId: unit.id,
            ownerId: dbOwner.id,
            role,
            ...(passwordHash ? { passwordHash } : {}),
          };
          if (existingAdmin) {
            await tx.admin.update({ where: { id: existingAdmin.id }, data: adminData });
            const emailChanged = didLoginEmailChange(existingAdmin.email, loginEmail);
            if (emailChanged) loginEmailChanges++;
            if (passwordHash || existingAdmin.role !== role || emailChanged) {
              const revoked = await tx.adminSession.updateMany({
                where: { adminId: existingAdmin.id, revokedAt: null },
                data: { revokedAt: new Date() },
              });
              revokedSessions += revoked.count;
            }
          } else {
            if (!passwordHash) throw new Error("Nový účet nemá heslo.");
            await tx.admin.create({ data: { ...adminData, passwordHash } });
          }
        } else if (existingAdmin) {
          // If the email is cleared, delete the admin record
          assertLinkedAccountDeletionAllowed(session, [existingAdmin]);
          loginEmailChanges++;
          const revoked = await tx.adminSession.updateMany({
            where: { adminId: existingAdmin.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          revokedSessions += revoked.count;
          await tx.admin.delete({ where: { id: existingAdmin.id } });
          deletedLinkedAccounts++;
        }
      }

      await createAuditLogEntryWithTx(tx, "UNIT_UPDATED", `admin:${session.email}`, {
        message: `Údaje jednotky č. ${no} boli upravené.`,
        unitId,
        unitNo: no,
        loginEmailChanges,
        revokedSessions,
        deletedLinkedAccounts,
      });

      return {
        ...unit,
        owners: updatedOwners
      };
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ success: true, unit: updatedUnit });
  } catch (err) {
    console.error("Unit update error:", err);
    return NextResponse.json({ error: "Chyba pri ukladaní údajov jednotky." }, { status: 500 });
  }
}
