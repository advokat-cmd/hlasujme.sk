import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { acquirePollLock } from "@/lib/pollLock";
import { PollConflict } from "@/lib/pollLifecycle";

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
    const questionNo = Number(noStr);
    const { attachmentUrl } = await request.json();

    if (typeof attachmentUrl !== "string" || !/^\/api\/document\/[a-zA-Z0-9-]+$/.test(attachmentUrl) || !Number.isSafeInteger(questionNo) || questionNo < 1) {
      return NextResponse.json({ error: "Chýba odkaz na prílohu." }, { status: 400 });
    }

    await db.$transaction(async tx => {
      await acquirePollLock(tx, pollId);
      const poll = await tx.poll.findUnique({ where: { id: pollId } });
      if (!poll || poll.status !== "draft") throw new PollConflict("Prílohy možno meniť iba v návrhu hlasovania.");
      const document = await tx.pollDocument.findFirst({ where: { id: attachmentUrl.split("/").pop(), pollId } });
      if (!document) throw new PollConflict("Príloha nepatrí k tomuto hlasovaniu.");
    const question = await tx.question.findFirst({
      where: { pollId, no: questionNo }
    });

    if (!question) {
      throw new PollConflict("Otázka nebola nájdená.");
    }

    const updatedAttachments = [...new Set([...question.attachments, attachmentUrl])];

    await tx.question.update({
      where: { id: question.id },
      data: { attachments: updatedAttachments }
    });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof PollConflict) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error("Attach file to question error:", err);
    return NextResponse.json({ error: "Interná chyba servera." }, { status: 500 });
  }
}
