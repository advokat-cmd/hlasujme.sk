import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { createAuditLogEntry } from "@/lib/hashChain";

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
    await db.poll.delete({
      where: { id: pollId }
    });

    // 4. Create audit log entry
    await createAuditLogEntry(
      "POLL_DELETED",
      `admin:${session.email}`,
      {
        message: `Bolo natrvalo vymazané hlasovanie "${poll.title}".`,
        pollId: poll.id,
        title: poll.title
      }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Poll delete API error:", err);
    return NextResponse.json({ error: "Nepodarilo sa vymazať hlasovanie." }, { status: 500 });
  }
}
