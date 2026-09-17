import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { generateVoteTokens } from "@/lib/tokens";
import { sendEmail, getInvitationEmail } from "@/lib/email";
import { createAuditLogEntryWithTx, createAuditLogEntry } from "@/lib/hashChain";
import { acquirePollLock } from "@/lib/pollLock";
import { lockBuilding, PollConflict } from "@/lib/pollLifecycle";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAdminSession();
    if (!session || session.role === "vlastnik") return NextResponse.json({ error: "Nedostatočné oprávnenia." }, { status: 403 });
    const { id: pollId } = await params;
    const target = await db.poll.findUnique({ where: { id: pollId }, select: { buildingId: true } });
    if (!target) return NextResponse.json({ error: "Hlasovanie nebolo nájdené." }, { status: 404 });
    const published = await db.$transaction(async tx => {
      await lockBuilding(tx, target.buildingId);
      await acquirePollLock(tx, pollId);
      const poll = await tx.poll.findUnique({ where: { id: pollId }, include: { building: true, questions: true } });
      if (!poll) throw new PollConflict("Hlasovanie neexistuje.");
      if (poll.status === "active") return { poll, tokens: [], alreadyActive: true };
      if (poll.status !== "draft") throw new PollConflict("Vyhlásiť možno iba návrh hlasovania.");
      if (poll.endAt <= new Date()) throw new PollConflict("Termín hlasovania už uplynul. Pripravte návrh s novým termínom.");
      if (!poll.questions.length) throw new PollConflict("Hlasovanie musí obsahovať otázky.");
      const activeUnits = await tx.unit.count({ where: { buildingId: poll.buildingId, status: "active" } });
      if (!activeUnits) throw new PollConflict("Dom nemá žiadne aktívne hlasovacie jednotky.");
      const tokens = await generateVoteTokens(pollId, tx);
      if (!tokens.length) throw new PollConflict("Žiadna aktívna jednotka nemá e-mail na doručenie pozvánky. Doplňte register.");
      await tx.poll.update({ where: { id: pollId }, data: { status: "active", announcedAt: new Date() } });
      await createAuditLogEntryWithTx(tx, "POLL_CREATED", `admin:${session.email}`, {
        message: `Bolo vyhlásené hlasovanie "${poll.title}".`, pollId, title: poll.title,
        questionsCount: poll.questions.length, recipientsCount: tokens.length,
      });
      return { poll, tokens, alreadyActive: false };
    }, { maxWait: 10000, timeout: 30000 });

    if (published.alreadyActive) return NextResponse.json({ success: true, pollId, alreadyActive: true });
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const endFormatted = published.poll.endAt.toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" });
    const deliveries = await Promise.allSettled(published.tokens.map(async token => {
      const email = await getInvitationEmail({
        ownerName: token.ownerName || "vlastník", buildingName: published.poll.building.name,
        pollTitle: published.poll.title, pollReason: published.poll.reason, endFormatted,
        magicLink: `${baseUrl}/hlasuj/${token.token}`,
      });
      return sendEmail({ to: token.email, subject: email.subject, html: email.html });
    }));
    const sentCount = deliveries.filter(result => result.status === "fulfilled" && result.value).length;
    const failedCount = deliveries.length - sentCount;
    await createAuditLogEntry("POLL_INVITATIONS_SENT", `admin:${session.email}`, {
      message: `Pozvánky k hlasovaniu "${published.poll.title}": odoslané ${sentCount}, neúspešné ${failedCount}.`,
      pollId, sentCount, failedCount,
    });
    return NextResponse.json({ success: true, pollId, sentCount, failedCount });
  } catch (error) {
    if (error instanceof PollConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("Poll activation API error:", error);
    return NextResponse.json({ error: "Vyhlásenie hlasovania zlyhalo. Skontrolujte jeho stav; odoslanie pozvánok možno zopakovať v detaile." }, { status: 500 });
  }
}
