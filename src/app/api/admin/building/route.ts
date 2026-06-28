import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { createAuditLogEntry } from "@/lib/hashChain";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || session.role === "vlastnik") {
      return NextResponse.json({ error: "Nedostatočné oprávnenia." }, { status: 403 });
    }

    const body = await request.json();
    const { name, short, address, entrance, manager, contact, contactEmail } = body;

    const building = await db.building.findFirst();
    if (!building) {
      return NextResponse.json({ error: "Budova nebola nájdená." }, { status: 404 });
    }

    const updated = await db.building.update({
      where: { id: building.id },
      data: {
        name,
        short,
        address,
        entrance,
        manager,
        contact,
        contactEmail,
      },
    });

    await createAuditLogEntry("BUILDING_UPDATED", `admin:${session.email}`, {
      message: `Údaje bytového domu boli zmenené.`,
      buildingId: building.id,
      name,
    });

    revalidatePath("/admin/register");
    revalidatePath("/admin");

    return NextResponse.json({ success: true, building: updated });
  } catch (err) {
    console.error("Building update error:", err);
    return NextResponse.json({ error: "Chyba pri ukladaní údajov budovy." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || session.role === "vlastnik") {
      return NextResponse.json({ error: "Nedostatočné oprávnenia." }, { status: 403 });
    }

    const building = await db.building.findFirst();
    if (!building) {
      return NextResponse.json({ error: "Budova nebola nájdená." }, { status: 404 });
    }

    const units = await db.unit.findMany({
      where: { buildingId: building.id },
      include: {
        owners: true
      }
    });

    return NextResponse.json({ success: true, building, units });
  } catch (err) {
    console.error("Building fetch error:", err);
    return NextResponse.json({ error: "Chyba pri načítaní údajov budovy." }, { status: 500 });
  }
}
