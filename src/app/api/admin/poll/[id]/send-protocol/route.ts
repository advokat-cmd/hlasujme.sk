import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { sendEmail, getProtocolEmail } from "@/lib/email";
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

    const poll = await db.poll.findUnique({
      where: { id: pollId },
      include: {
        building: true,
        sealedResult: true
      }
    });

    if (!poll) {
      return NextResponse.json({ error: "Hlasovanie nebolo nájdené." }, { status: 404 });
    }

    if (!poll.sealedResult) {
      return NextResponse.json({
        error: "Zápisnica pre toto hlasovanie zatiaľ nebola vytvorená."
      }, { status: 400 });
    }

    // Fetch all units and owners for the building
    const units = await db.unit.findMany({
      where: { buildingId: poll.buildingId },
      include: { owners: true }
    });

    const recipients: Array<{ email: string; name: string }> = [];
    const seenEmails = new Set<string>();

    for (const u of units) {
      if (u.coMode === "internal") {
        for (const o of u.owners) {
          if (o.email && o.email.trim()) {
            const emailTrimmed = o.email.trim().toLowerCase();
            if (!seenEmails.has(emailTrimmed)) {
              seenEmails.add(emailTrimmed);
              recipients.push({ email: o.email.trim(), name: o.name });
            }
          }
        }
      } else {
        if (u.email && u.email.trim()) {
          const emailTrimmed = u.email.trim().toLowerCase();
          if (!seenEmails.has(emailTrimmed)) {
            seenEmails.add(emailTrimmed);
            let ownerName = "vlastník";
            if (u.coMode === "rep" && u.actingPerson) {
              ownerName = u.actingPerson;
            } else if (u.owners.length > 0) {
              ownerName = u.owners[0].name;
            }
            recipients.push({ email: u.email.trim(), name: ownerName });
          }
        }
      }
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: "Neboli nájdení žiadni vlastníci s e-mailovou adresou." }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const protocolLink = `${baseUrl}/api/sealed/${poll.id}/pdf`;

    const emailPromises = recipients.map(async (r) => {
      const emailContent = await getProtocolEmail({
        ownerName: r.name,
        buildingName: poll.building.name,
        pollTitle: poll.title,
        protocolLink
      });

      const sent = await sendEmail({
        to: r.email,
        subject: emailContent.subject,
        html: emailContent.html
      });

      if (sent) {
        // Log to database
        await db.protocolEmailLog.create({
          data: {
            pollId: poll.id,
            email: r.email,
            sentAt: new Date()
          }
        });
      }

      return sent;
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(Boolean).length;

    await createAuditLogEntry("PROTOCOL_SENT_TO_OWNERS", `admin:${session.email}`, {
      message: `Odkaz na stiahnutie zápisnice z hlasovania "${poll.title}" bol odoslaný ${successCount} vlastníkom.`,
      pollId: poll.id,
      recipientsCount: recipients.length,
      successCount
    });

    return NextResponse.json({ success: true, successCount });
  } catch (err) {
    console.error("Send protocol email error:", err);
    return NextResponse.json({ error: "Interná chyba pri odosielaní zápisnice." }, { status: 500 });
  }
}
