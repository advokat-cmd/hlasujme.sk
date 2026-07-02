import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { sendProtocolEmails } from "@/lib/protocolEmail";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session || session.role === "vlastnik") {
      return NextResponse.json({ error: "Nedostatočné oprávnenia." }, { status: 403 });
    }

    const { id: pollId } = await params;

    const poll = await db.poll.findUnique({
      where: { id: pollId },
      include: { sealedResult: true }
    });

    if (!poll) {
      return NextResponse.json({ error: "Hlasovanie nebolo nájdené." }, { status: 404 });
    }

    if (!poll.sealedResult) {
      return NextResponse.json({
        error: "Zápisnica pre toto hlasovanie zatiaľ nebola vytvorená."
      }, { status: 400 });
    }

    const summary = await sendProtocolEmails(pollId, `admin:${session.email}`);

    if (summary.recipientsCount === 0) {
      return NextResponse.json({ error: "Neboli nájdení žiadni vlastníci s e-mailovou adresou." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      successCount: summary.sentCount,
      failedCount: summary.failedCount,
      skippedCount: summary.skippedCount
    });
  } catch (err) {
    console.error("Send protocol email error:", err);
    return NextResponse.json({ error: "Interná chyba pri odosielaní zápisnice." }, { status: 500 });
  }
}
