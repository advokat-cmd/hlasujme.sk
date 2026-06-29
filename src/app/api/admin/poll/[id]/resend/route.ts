import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { sendEmail, getInvitationEmail } from "@/lib/email";
import crypto from "crypto";
import { createAuditLogEntry } from "@/lib/hashChain";

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
    const body = await request.json();
    const { email, unitNo } = body as { email: string; unitNo: string };

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

    const unit = await db.unit.findFirst({
      where: { buildingId: poll.buildingId, no: unitNo },
      include: { owners: true }
    });

    if (!unit) {
      return NextResponse.json({ error: "Byt nebol nájdený." }, { status: 404 });
    }

    let ownerId: string | null = null;
    let ownerName = "vlastník";

    if (unit.coMode === "internal") {
      // Find the specific owner by email
      const owner = unit.owners.find(o => o.email?.trim().toLowerCase() === email.trim().toLowerCase());
      if (!owner) {
        return NextResponse.json({ error: "Vlastník s týmto e-mailom nebol nájdený." }, { status: 404 });
      }
      ownerId = owner.id;
      ownerName = owner.name;
    } else {
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
      // Delete old token if exists
      await tx.voteToken.deleteMany({
        where: {
          pollId,
          unitId: unit.id,
          ownerId
        }
      });

      // Create new token
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
      minute: "2-digit"
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
      return NextResponse.json({ error: "E-mail sa nepodarilo odoslať." }, { status: 500 });
    }

    await createAuditLogEntry("VOTE_TOKEN_RESENT", `admin:${session.email}`, {
      message: `Znova odoslaná pozvánka pre vlastníka ${ownerName} (Byt č. ${unit.no}, e-mail: ${email}).`,
      pollId,
      unitNo: unit.no,
      email
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Resend token error:", err);
    return NextResponse.json({ error: "Interná chyba servera." }, { status: 500 });
  }
}
