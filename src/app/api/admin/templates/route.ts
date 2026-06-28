import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { createAuditLogEntry } from "@/lib/hashChain";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Neprihlásený administrátor." }, { status: 401 });
    }

    const templates = await db.questionTemplate.findMany({
      orderBy: { createdAt: "asc" }
    });

    return NextResponse.json({ templates });
  } catch (err) {
    console.error("Fetch templates error:", err);
    return NextResponse.json({ error: "Interná chyba servera." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || session.role === "vlastnik") {
      return NextResponse.json({ error: "Nedostatočné oprávnenia." }, { status: 403 });
    }

    const { title, text, majorityType, note } = await request.json();
    if (!title || !text || !majorityType) {
      return NextResponse.json({ error: "Názov, text a väčšina sú povinné." }, { status: 400 });
    }

    const template = await db.questionTemplate.create({
      data: {
        title: title.trim(),
        text: text.trim(),
        majorityType: majorityType.trim(),
        note: note ? note.trim() : null
      }
    });

    await createAuditLogEntry("TEMPLATE_CREATED", `admin:${session.email}`, {
      message: `Bola vytvorená nová šablóna otázky: ${template.title}.`,
      templateId: template.id,
      title: template.title
    });

    return NextResponse.json({ success: true, template });
  } catch (err) {
    console.error("Create template error:", err);
    return NextResponse.json({ error: "Interná chyba pri vytváraní šablóny." }, { status: 500 });
  }
}
