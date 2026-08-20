import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { UnitType, CoMode, OwnerRole } from "@prisma/client";
import { createAuditLogEntryWithTx } from "@/lib/hashChain";
import * as argon2 from "argon2";
import { validateNewPassword, validateOptionalEmail, validateOwners, type NormalizedOwner } from "@/lib/security/input";
import { assertAccountMutationAllowed } from "@/lib/security/accounts";
import { synchronizeSingleOwnerEmail } from "@/lib/unitEmails";

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || session.role === "vlastnik") {
      return NextResponse.json({ error: "Nedostatočné oprávnenia." }, { status: 403 });
    }

    const building = await db.building.findFirst();
    if (!building) {
      return NextResponse.json({ error: "Budova nebola nájdená." }, { status: 404 });
    }

    const body = await request.json();
    const { no, type, floor, email, coMode } = body as {
      no: string;
      type: "byt" | "nebyt";
      floor: string;
      email: string;
      coMode: string;
    };

    if (!no) {
      return NextResponse.json({ error: "Číslo jednotky je povinné." }, { status: 400 });
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
        if (!owner.admin && !owner.password) continue;
        if (!owner.email) throw new Error("Prihlasovací účet vyžaduje e-mail.");
        if (!owner.password) throw new Error("Nový prihlasovací účet vyžaduje bezpečné heslo.");
        validateNewPassword(owner.password);
        const requestedRole = owner.admin ? "admin" : "vlastnik";
        assertAccountMutationAllowed(session, null, requestedRole);
        const conflict = await db.admin.findUnique({ where: { email: owner.email } });
        if (conflict) {
          return NextResponse.json({ error: `E-mail ${owner.email} už používa iný účet.` }, { status: 409 });
        }
      }
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Neplatné údaje vlastníkov." }, { status: 400 });
    }

    // Check duplicate
    const duplicate = await db.unit.findFirst({
      where: { buildingId: building.id, no: no.trim() },
    });
    if (duplicate) {
      return NextResponse.json({ error: `Jednotka s číslom ${no} už existuje.` }, { status: 400 });
    }

    const passwordHashes = await Promise.all(owners.map((owner) =>
      owner.password
        ? argon2.hash(validateNewPassword(owner.password), { type: argon2.argon2id })
        : Promise.resolve(undefined),
    ));

    const unit = await db.$transaction(async (tx) => {
      const createdUnit = await tx.unit.create({
        data: {
          no: no.trim(),
          type: type === "nebyt" ? UnitType.nebyt : UnitType.byt,
          floor: floor.trim(),
          votes: 1,
          coMode: coMode as CoMode,
          email: unitEmail || null,
          buildingId: building.id,
        },
      });

      const createdOwners = [];
      for (let index = 0; index < owners.length; index++) {
        const owner = owners[index];
        const ownerRecord = await tx.owner.create({
          data: {
            unitId: createdUnit.id,
            first: owner.first,
            last: owner.last,
            name: `${owner.first} ${owner.last}`,
            email: owner.email || null,
            phone: owner.phone || null,
            birthDate: owner.birthDate || null,
            share: owner.share,
            role: owner.role as OwnerRole,
          },
        });
        createdOwners.push(ownerRecord);
        const passwordHash = passwordHashes[index];
        if (!owner.email || (!owner.admin && !passwordHash)) continue;
        await tx.admin.create({
          data: {
            email: owner.email,
            passwordHash: passwordHash!,
            name: ownerRecord.name,
            role: owner.admin ? "admin" : "vlastnik",
            unitId: createdUnit.id,
            ownerId: ownerRecord.id,
          },
        });
      }

      await tx.building.update({
        where: { id: building.id },
        data: { unitsCount: { increment: 1 } },
      });
      await createAuditLogEntryWithTx(tx, "UNIT_CREATED", `admin:${session.email}`, {
        message: `Bolo pridaná nová jednotka č. ${no}.`,
        unitId: createdUnit.id,
        unitNo: no,
      });
      return { ...createdUnit, owners: createdOwners };
    });

    return NextResponse.json({ success: true, unit });
  } catch (err) {
    console.error("Unit create error:", err);
    return NextResponse.json({ error: "Chyba pri pridaní jednotky." }, { status: 500 });
  }
}
