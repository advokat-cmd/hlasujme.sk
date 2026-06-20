import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { UnitType, CoMode, OwnerRole } from "@prisma/client";
import { createAuditLogEntry } from "@/lib/hashChain";
import * as argon2 from "argon2";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Neprihlásený administrátor." }, { status: 401 });
    }

    const { id: unitId } = await params;
    const body = await request.json();
    const { no, type, floor, email, coMode, owners } = body as {
      no: string;
      type: "byt" | "nebyt";
      floor: string;
      email: string;
      coMode: string;
      owners: any[];
    };

    const existingUnit = await db.unit.findUnique({
      where: { id: unitId },
      include: { owners: true }
    });

    if (!existingUnit) {
      return NextResponse.json({ error: "Jednotka nebola nájdená." }, { status: 404 });
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
          email: email.trim() || null
        }
      });

      // 2. Sync owners
      const payloadOwnerIds = owners.map(o => o.id).filter(Boolean);
      
      // Delete old owners no longer in payload
      const ownersToDelete = existingUnit.owners.filter(o => !payloadOwnerIds.includes(o.id));
      for (const o of ownersToDelete) {
        await tx.owner.delete({ where: { id: o.id } });
      }

      const updatedOwners = [];

      for (const o of owners) {
        const ownerName = `${o.first.trim()} ${o.last.trim()}`.trim();
        const ownerEmail = o.email.trim() || null;
        
        let dbOwner;
        if (o.id && existingUnit.owners.some(eo => eo.id === o.id)) {
          // Update existing
          dbOwner = await tx.owner.update({
            where: { id: o.id },
            data: {
              first: o.first.trim(),
              last: o.last.trim(),
              name: ownerName,
              email: ownerEmail,
              share: o.share || 1.0,
              role: o.role as OwnerRole || OwnerRole.owner
            }
          });
        } else {
          // Create new
          dbOwner = await tx.owner.create({
            data: {
              unitId,
              first: o.first.trim(),
              last: o.last.trim(),
              name: ownerName,
              email: ownerEmail,
              share: o.share || 1.0,
              role: o.role as OwnerRole || OwnerRole.owner
            }
          });
        }

        updatedOwners.push(dbOwner);

        // Update/create Admin user if marked
        if (o.admin) {
          const loginEmail = (o.email || email).trim().toLowerCase();
          if (loginEmail) {
            const adminData: any = {
              name: ownerName,
              email: loginEmail,
              unitId: unit.id,
              ownerId: dbOwner.id
            };
            if (o.password) {
              adminData.passwordHash = await argon2.hash(o.password, { type: argon2.argon2id });
            }

            await tx.admin.upsert({
              where: { email: loginEmail },
              update: adminData,
              create: {
                ...adminData,
                passwordHash: adminData.passwordHash || (await argon2.hash("demo1234", { type: argon2.argon2id }))
              }
            });
          }
        } else {
          // If was admin, remove admin rights (delete admin record linked to this owner)
          const adminRecord = await tx.admin.findFirst({
            where: { ownerId: dbOwner.id }
          });
          if (adminRecord) {
            await tx.admin.delete({ where: { id: adminRecord.id } });
          }
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
