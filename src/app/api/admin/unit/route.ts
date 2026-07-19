import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { UnitType, CoMode, OwnerRole } from "@prisma/client";
import { createAuditLogEntry } from "@/lib/hashChain";
import * as argon2 from "argon2";
import { validateNewPassword, validateOwners } from "@/lib/security/input";
import { assertAccountMutationAllowed } from "@/lib/security/accounts";

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

    let owners;
    try {
      owners = validateOwners(body.owners, coMode);
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

    // Create unit
    const unit = await db.unit.create({
      data: {
        no: no.trim(),
        type: type === "nebyt" ? UnitType.nebyt : UnitType.byt,
        floor: floor.trim(),
        votes: 1,
        coMode: coMode as CoMode,
        email: typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null,
        buildingId: building.id,
        owners: {
          create: owners.map((o) => ({
            first: o.first,
            last: o.last,
            name: `${o.first} ${o.last}`,
            email: o.email || null,
            phone: o.phone || null,
            birthDate: o.birthDate || null,
            share: o.share,
            role: o.role as OwnerRole,
          })),
        },
      },
      include: {
        owners: true,
      },
    });

    // Create admin user if requested
    for (let i = 0; i < owners.length; i++) {
      const o = owners[i];
      const loginEmail = o.email?.trim().toLowerCase();
      if (loginEmail && (o.admin || o.password)) {
        const role = o.admin ? "admin" : "vlastnik";
        const passwordHash = await argon2.hash(validateNewPassword(o.password), { type: argon2.argon2id });
        const ownerRecord = unit.owners[i];
        
        await db.admin.upsert({
          where: { email: loginEmail },
          update: {
            passwordHash,
            name: ownerRecord.name,
            role,
            unitId: unit.id,
            ownerId: ownerRecord.id,
          },
          create: {
            email: loginEmail,
            passwordHash,
            name: ownerRecord.name,
            role,
            unitId: unit.id,
            ownerId: ownerRecord.id,
          },
        });
      }
    }

    // Update building unitsCount
    await db.building.update({
      where: { id: building.id },
      data: { unitsCount: { increment: 1 } },
    });

    await createAuditLogEntry("UNIT_CREATED", `admin:${session.email}`, {
      message: `Bolo pridaná nová jednotka č. ${no}.`,
      unitId: unit.id,
      unitNo: no,
    });

    return NextResponse.json({ success: true, unit });
  } catch (err) {
    console.error("Unit create error:", err);
    return NextResponse.json({ error: "Chyba pri pridaní jednotky." }, { status: 500 });
  }
}
