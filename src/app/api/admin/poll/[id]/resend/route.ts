import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { sendEmail, getInvitationEmail } from "@/lib/email";
import crypto from "crypto";
import { createAuditLogEntry } from "@/lib/hashChain";
import { validateOptionalEmail } from "@/lib/security/input";
import { acquirePollLock } from "@/lib/pollLock";
import { PollConflict } from "@/lib/pollLifecycle";

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
    let email: string;
    let unitNo: string;
    let requestedOwnerId: string | undefined;
    try {
      const body = await request.json();
      email = validateOptionalEmail(body?.email);
      unitNo = typeof body?.unitNo === "string" ? body.unitNo.trim() : "";
      requestedOwnerId = typeof body?.ownerId === "string" ? body.ownerId : undefined;
    } catch {
      return NextResponse.json({ error: "Neplatný e-mail alebo číslo jednotky." }, { status: 400 });
    }

    if (!email || !unitNo) {
      return NextResponse.json({ error: "E-mail a číslo bytu sú povinné." }, { status: 400 });
    }

    const poll = await db.poll.findUnique({
      where: { id: pollId },
      include: { building: true }
    });

    if (!poll) {
      return NextResponse.json({ error: "Hlasovanie nebolo nájdené." }, { status: 404 });
    }
    if (poll.status !== "active" || poll.endAt < new Date()) {
      return NextResponse.json({ error: "Pozvánku možno odoslať len k vyhlásenému hlasovaniu pred jeho skončením." }, { status: 409 });
    }

    const unit = await db.unit.findFirst({
      where: { buildingId: poll.buildingId, no: unitNo },
      include: { owners: true }
    });

    if (!unit) {
      return NextResponse.json({ error: "Byt nebol nájdený." }, { status: 404 });
    }
    if (unit.status !== "active") return NextResponse.json({ error: "Jednotka nie je aktívna." }, { status: 409 });

    let ownerId: string | null = null;
    let ownerName = "vlastník";

    if (unit.coMode === "internal") {
      // Find the specific owner by email
      const matches = unit.owners.filter(o => (o.email || unit.email)?.trim().toLowerCase() === email && (!requestedOwnerId || o.id === requestedOwnerId));
      if (matches.length > 1) return NextResponse.json({ error: "Vyberte konkrétneho spoluvlastníka pre spoločnú e-mailovú adresu." }, { status: 409 });
      const owner = matches[0];
      if (!owner) {
        return NextResponse.json({ error: "Vlastník s týmto e-mailom nebol nájdený." }, { status: 404 });
      }
      ownerId = owner.id;
      ownerName = owner.name;
    } else {
      if (unit.email?.trim().toLowerCase() !== email) return NextResponse.json({ error: "Pozvánku možno poslať len na e-mail uvedený v registri jednotky." }, { status: 400 });
      if (unit.coMode === "rep" && unit.actingPerson) {
        ownerName = unit.actingPerson;
      } else if (unit.owners.length > 0) {
        ownerName = unit.owners[0].name;
      }
    }

    // Generate new token
    const plainToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(plainToken);

    // Perform database operations in transaction
    await db.$transaction(async (tx) => {
      await acquirePollLock(tx, pollId);
      const current = await tx.poll.findUnique({ where: { id: pollId } });
      if (!current || current.status !== "active" || current.endAt < new Date()) throw new PollConflict("Hlasovanie už nie je otvorené na odoslanie pozvánky.");
      // Resending adds an invitation; earlier links keep access to the same ballot.
      await tx.voteToken.create({
        data: {
          pollId,
          unitId: unit.id,
          ownerId,
          tokenHash,
          expiresAt: poll.endAt
        }
      });
    });

    // Send email invitation
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const formattedEnd = new Date(poll.endAt).toLocaleString("sk-SK", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Bratislava"
    });

    const magicLink = `${baseUrl}/hlasuj/${plainToken}`;
    const emailContent = await getInvitationEmail({
      ownerName,
      buildingName: poll.building.name,
      pollTitle: poll.title,
      pollReason: poll.reason,
      endFormatted: formattedEnd,
      magicLink
    });

    const sent = await sendEmail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html
    });

    if (!sent) {
      // A timeout can follow provider acceptance, so this link may already be delivered.
      // Keep it as well as older links; normal poll and owner validation still applies.
      return NextResponse.json({ error: "Prijatie e-mailu službou sa nepodarilo potvrdiť. Existujúce hlasovacie odkazy zostávajú platné." }, { status: 500 });
    }

    await createAuditLogEntry("VOTE_TOKEN_RESENT", `admin:${session.email}`, {
      message: `Znova odoslaná pozvánka pre vlastníka ${ownerName} (Byt č. ${unit.no}, e-mail: ${email}).`,
      pollId,
      unitNo: unit.no,
      email
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof PollConflict) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error("Resend token error:", err);
    return NextResponse.json({ error: "Interná chyba servera." }, { status: 500 });
  }
}
