import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { createAuditLogEntryWithTx } from "@/lib/hashChain";
import { acquirePollLock } from "@/lib/pollLock";
import { lockBuilding, PollConflict } from "@/lib/pollLifecycle";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Verify admin session
    const session = await getAdminSession();
    if (!session || session.role === "vlastnik") {
      return NextResponse.json({ error: "Nedostatočné oprávnenia." }, { status: 403 });
    }

    const { id: pollId } = await params;

    // 2. Fetch the poll to ensure it exists and get its title for logging
    const poll = await db.poll.findUnique({
      where: { id: pollId }
    });

    if (!poll) {
      return NextResponse.json({ error: "Hlasovanie nebolo nájdené." }, { status: 404 });
    }

    // 3. Delete from database (Prisma handles cascading deletes automatically)
    await db.$transaction(async tx => {
      await lockBuilding(tx, poll.buildingId);
      await acquirePollLock(tx, pollId);
      const current = await tx.poll.findUnique({ where: { id: pollId }, include: { sealedResult: true } });
      if (!current || current.status !== "draft" || current.sealedResult) throw new PollConflict("Vymazať možno iba nevyhlásený návrh. Vyhlásené hlasovanie a zápisnicu treba zachovať v archíve.");
    await tx.poll.delete({
      where: { id: pollId }
    });

    // 4. Create audit log entry
    await createAuditLogEntryWithTx(tx,
      "POLL_DELETED",
      `admin:${session.email}`,
      {
        message: `Bolo natrvalo vymazané hlasovanie "${poll.title}".`,
        pollId: poll.id,
        title: poll.title
      }
    );
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof PollConflict) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error("Poll delete API error:", err);
    return NextResponse.json({ error: "Nepodarilo sa vymazať hlasovanie." }, { status: 500 });
  }
}
