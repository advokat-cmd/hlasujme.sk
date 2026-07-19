import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { UnitType, CoMode, OwnerRole } from "@prisma/client";
import { createAuditLogEntry } from "@/lib/hashChain";
import * as argon2 from "argon2";
import { validateNewPassword, validateOwners, type NormalizedOwner } from "@/lib/security/input";
import { assertAccountMutationAllowed } from "@/lib/security/accounts";

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
      include: { owners: true }
    });

    if (!existingUnit) {
      return NextResponse.json({ error: "Jednotka nebola nájdená." }, { status: 404 });
    }

    let owners: NormalizedOwner[];
    try {
      owners = validateOwners(body.owners, coMode);
      for (const owner of owners) {
        const ownerAccount = owner.id ? await db.admin.findFirst({ where: { ownerId: owner.id } }) : null;
        const emailAccount = owner.email ? await db.admin.findUnique({ where: { email: owner.email } }) : null;
        if (emailAccount && emailAccount.ownerId !== owner.id) {
          return NextResponse.json({ error: `E-mail ${owner.email} už používa iný účet.` }, { status: 409 });
        }
        if (ownerAccount || owner.admin || owner.password) {
          const role = owner.admin ? "admin" : ownerAccount?.role === "superadmin" ? "superadmin" : "vlastnik";
          assertAccountMutationAllowed(session, ownerAccount, role);
          if (!ownerAccount && !owner.password) throw new Error("Nový prihlasovací účet vyžaduje bezpečné heslo.");
          if (owner.password) validateNewPassword(owner.password);
        }
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

    // Perform database transaction for unit update + owners sync
    const updatedUnit = await db.$transaction(async (tx) => {
      // 1. Update Unit
      const unit = await tx.unit.update({
        where: { id: unitId },
        data: {
          no: no.trim(),
          type: type === "nebyt" ? UnitType.nebyt : UnitType.byt,
          floor: floor.trim(),
          coMode: coMode as CoMode,
          email: typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null
        }
      });

      // 2. Sync owners
      const payloadOwnerIds = owners.map(o => o.id).filter(Boolean);
      
      // Delete old owners no longer in payload
      const ownersToDelete = existingUnit.owners.filter(o => !payloadOwnerIds.includes(o.id));
      for (const o of ownersToDelete) {
        const account = await tx.admin.findFirst({ where: { ownerId: o.id } });
        if (account) {
          await tx.adminSession.updateMany({ where: { adminId: account.id, revokedAt: null }, data: { revokedAt: new Date() } });
          await tx.admin.delete({ where: { id: account.id } });
        }
        await tx.owner.delete({ where: { id: o.id } });
      }

      const updatedOwners = [];

      for (const o of owners) {
        const ownerName = `${o.first} ${o.last}`;
        const ownerEmail = o.email || null;
        
        let dbOwner;
        if (o.id && existingUnit.owners.some(eo => eo.id === o.id)) {
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
        const existingAdmin = await tx.admin.findFirst({
          where: { ownerId: dbOwner.id }
        });

        const loginEmail = o.email;
        
        if (loginEmail && (o.admin || o.password || existingAdmin)) {
          // Determine the role
          const role = o.admin 
            ? "admin" 
            : (existingAdmin?.role === "superadmin" ? "superadmin" : "vlastnik");

          const passwordHash = o.password
            ? await argon2.hash(validateNewPassword(o.password), { type: argon2.argon2id })
            : undefined;
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
            if (passwordHash || existingAdmin.role !== role) {
              await tx.adminSession.updateMany({ where: { adminId: existingAdmin.id, revokedAt: null }, data: { revokedAt: new Date() } });
            }
          } else {
            if (!passwordHash) throw new Error("Nový účet nemá heslo.");
            await tx.admin.create({ data: { ...adminData, passwordHash } });
          }
        } else if (existingAdmin) {
          // If the email is cleared, delete the admin record
          await tx.admin.delete({ where: { id: existingAdmin.id } });
        }
      }

      return {
        ...unit,
        owners: updatedOwners
      };
    });

    await createAuditLogEntry("UNIT_UPDATED", `admin:${session.email}`, {
      message: `Údaje jednotky č. ${no} boli upravené.`,
      unitId,
      unitNo: no,
    });

    return NextResponse.json({ success: true, unit: updatedUnit });
  } catch (err) {
    console.error("Unit update error:", err);
    return NextResponse.json({ error: "Chyba pri ukladaní údajov jednotky." }, { status: 500 });
  }
}
