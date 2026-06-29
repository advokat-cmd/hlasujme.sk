import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { createAuditLogEntry } from "@/lib/hashChain";

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || session.role === "vlastnik") {
      return NextResponse.json({ error: "Nedostatočné oprávnenia." }, { status: 403 });
    }

    const { key, subject, body } = await request.json();
    if (!key || !subject || !body) {
      return NextResponse.json({ error: "Kľúč, predmet a telo šablóny sú povinné." }, { status: 400 });
    }

    const template = await db.emailTemplate.upsert({
      where: { key },
      update: {
        subject: subject.trim(),
        body: body.trim(),
      },
      create: {
        key,
        subject: subject.trim(),
        body: body.trim(),
      }
    });

    await createAuditLogEntry("EMAIL_TEMPLATE_UPDATED", `admin:${session.email}`, {
      message: `Bola upravená e-mailová šablóna: ${key === "invitation" ? "Pozvánka na hlasovanie" : key}.`,
      key,
      subject: template.subject
    });

    return NextResponse.json({ success: true, template });
  } catch (err) {
    console.error("Save email template error:", err);
    return NextResponse.json({ error: "Interná chyba pri ukladaní e-mailovej šablóny." }, { status: 500 });
  }
}
