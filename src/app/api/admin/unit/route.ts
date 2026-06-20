import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { UnitType, CoMode, OwnerRole } from "@prisma/client";
import { createAuditLogEntry } from "@/lib/hashChain";
import * as argon2 from "argon2";

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Neprihlásený administrátor." }, { status: 401 });
    }

    const building = await db.building.findFirst();
    if (!building) {
      return NextResponse.json({ error: "Budova nebola nájdená." }, { status: 404 });
    }

    const body = await request.json();
    const { no, type, floor, email, coMode, owners } = body as {
      no: string;
      type: "byt" | "nebyt";
      floor: string;
      email: string;
      coMode: string;
      owners: any[];
    };

    if (!no) {
      return NextResponse.json({ error: "Číslo jednotky je povinné." }, { status: 400 });
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
        email: email.trim() || null,
        buildingId: building.id,
        owners: {
          create: owners.map((o) => ({
            first: o.first.trim(),
            last: o.last.trim(),
            name: `${o.first.trim()} ${o.last.trim()}`.trim(),
            email: o.email.trim() || null,
            share: o.share || 1.0,
            role: o.role as OwnerRole || OwnerRole.owner,
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
      if (o.admin && o.password) {
        const loginEmail = (o.email || email).trim().toLowerCase();
        if (loginEmail) {
          const passwordHash = await argon2.hash(o.password, { type: argon2.argon2id });
          const ownerRecord = unit.owners[i];
          
          await db.admin.upsert({
            where: { email: loginEmail },
            update: {
              passwordHash,
              name: ownerRecord.name,
              unitId: unit.id,
              ownerId: ownerRecord.id,
            },
            create: {
              email: loginEmail,
              passwordHash,
              name: ownerRecord.name,
              unitId: unit.id,
              ownerId: ownerRecord.id,
            },
          });
        }
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
