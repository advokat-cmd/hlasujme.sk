import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { createAuditLogEntry } from "@/lib/hashChain";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session || session.role === "vlastnik") {
      return NextResponse.json({ error: "Nedostatočné oprávnenia." }, { status: 403 });
    }

    const { id } = await params;
    const { title, text, majorityType, note } = await request.json();
    if (!title || !text || !majorityType) {
      return NextResponse.json({ error: "Názov, text a väčšina sú povinné." }, { status: 400 });
    }

    const updated = await db.questionTemplate.update({
      where: { id },
      data: {
        title: title.trim(),
        text: text.trim(),
        majorityType: majorityType.trim(),
        note: note ? note.trim() : null
      }
    });

    await createAuditLogEntry("TEMPLATE_UPDATED", `admin:${session.email}`, {
      message: `Šablóna otázky bola upravená: ${updated.title}.`,
      templateId: updated.id,
      title: updated.title
    });

    return NextResponse.json({ success: true, template: updated });
  } catch (err) {
    console.error("Update template error:", err);
    return NextResponse.json({ error: "Interná chyba pri úprave šablóny." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session || session.role === "vlastnik") {
      return NextResponse.json({ error: "Nedostatočné oprávnenia." }, { status: 403 });
    }

    const { id } = await params;

    const deleted = await db.questionTemplate.delete({
      where: { id }
    });

    await createAuditLogEntry("TEMPLATE_DELETED", `admin:${session.email}`, {
      message: `Šablóna otázky bola zmazaná: ${deleted.title}.`,
      templateId: deleted.id,
      title: deleted.title
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete template error:", err);
    return NextResponse.json({ error: "Interná chyba pri mazaní šablóny." }, { status: 500 });
  }
}
