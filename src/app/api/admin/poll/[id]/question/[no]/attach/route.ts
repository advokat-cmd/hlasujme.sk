import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; no: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session || session.role === "vlastnik") {
      return NextResponse.json({ error: "Nedostatočné oprávnenia." }, { status: 403 });
    }

    const { id: pollId, no: noStr } = await params;
    const questionNo = parseInt(noStr, 10);
    const { attachmentUrl } = await request.json();

    if (!attachmentUrl) {
      return NextResponse.json({ error: "Chýba odkaz na prílohu." }, { status: 400 });
    }

    const question = await db.question.findFirst({
      where: { pollId, no: questionNo }
    });

    if (!question) {
      return NextResponse.json({ error: "Otázka nebola nájdená." }, { status: 404 });
    }

    const updatedAttachments = [...question.attachments, attachmentUrl];

    await db.question.update({
      where: { id: question.id },
      data: { attachments: updatedAttachments }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Attach file to question error:", err);
    return NextResponse.json({ error: "Interná chyba servera." }, { status: 500 });
  }
}
