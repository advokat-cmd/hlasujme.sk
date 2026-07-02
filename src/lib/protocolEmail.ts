import crypto from "crypto";
import { db } from "./db";
import { sendEmail, getProtocolEmailTemplate, renderProtocolEmail } from "./email";
import { createAuditLogEntry } from "./hashChain";
import { getSessionSecret } from "./session";

/**
 * HMAC signature that authorizes downloading the sealed protocol PDF of one
 * poll without a login session. Sent to owners inside the protocol email.
 */
export function signSealedPdfAccess(pollId: string): string {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(`sealed-pdf:${pollId}`)
    .digest("hex");
}

export function verifySealedPdfAccess(pollId: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = signSealedPdfAccess(pollId);
  const provided = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(provided, expectedBuf);
}

export function buildProtocolDownloadLink(pollId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return `${baseUrl}/api/sealed/${pollId}/pdf?sig=${signSealedPdfAccess(pollId)}`;
}

export interface ProtocolEmailSummary {
  recipientsCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
}

interface Recipient {
  email: string;
  name: string;
}

/**
 * Sends the "protocol is ready" email to all owners of the poll's building.
 * - deduplicates addresses,
 * - skips addresses already logged in ProtocolEmailLog (no double sending),
 * - loads the email template from DB only once.
 */
export async function sendProtocolEmails(pollId: string, actor: string): Promise<ProtocolEmailSummary> {
  const poll = await db.poll.findUnique({
    where: { id: pollId },
    include: { building: true }
  });

  if (!poll) {
    throw new Error(`Poll ${pollId} not found`);
  }

  const [units, alreadySentLogs] = await Promise.all([
    db.unit.findMany({
      where: { buildingId: poll.buildingId },
      include: { owners: true }
    }),
    db.protocolEmailLog.findMany({
      where: { pollId },
      select: { email: true }
    })
  ]);

  const alreadySent = new Set(alreadySentLogs.map(l => l.email.trim().toLowerCase()));

  const recipients: Recipient[] = [];
  const seenEmails = new Set<string>();

  const addRecipient = (email: string | null | undefined, name: string) => {
    if (!email || !email.trim()) return;
    const key = email.trim().toLowerCase();
    if (seenEmails.has(key)) return;
    seenEmails.add(key);
    recipients.push({ email: email.trim(), name });
  };

  for (const u of units) {
    if (u.coMode === "internal") {
      for (const o of u.owners) {
        addRecipient(o.email, o.name);
      }
    } else {
      let ownerName = "vlastník";
      if (u.coMode === "rep" && u.actingPerson) {
        ownerName = u.actingPerson;
      } else if (u.owners.length > 0) {
        ownerName = u.owners[0].name;
      }
      addRecipient(u.email, ownerName);
    }
  }

  const toSend = recipients.filter(r => !alreadySent.has(r.email.toLowerCase()));
  const skippedCount = recipients.length - toSend.length;

  if (toSend.length === 0) {
    return {
      recipientsCount: recipients.length,
      sentCount: 0,
      failedCount: 0,
      skippedCount
    };
  }

  const protocolLink = buildProtocolDownloadLink(poll.id);
  const template = await getProtocolEmailTemplate();

  const results = await Promise.all(
    toSend.map(async (r) => {
      try {
        const emailContent = renderProtocolEmail(template, {
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
          await db.protocolEmailLog.create({
            data: {
              pollId: poll.id,
              email: r.email,
              sentAt: new Date()
            }
          });
        }

        return sent;
      } catch (e) {
        console.error(`Failed to send protocol email to ${r.email}:`, e);
        return false;
      }
    })
  );

  const sentCount = results.filter(Boolean).length;
  const failedCount = toSend.length - sentCount;

  await createAuditLogEntry("PROTOCOL_SENT_TO_OWNERS", actor, {
    message: `Odkaz na stiahnutie zápisnice z hlasovania "${poll.title}" bol odoslaný ${sentCount} vlastníkom.`,
    pollId: poll.id,
    recipientsCount: recipients.length,
    successCount: sentCount,
    failedCount,
    skippedAlreadySent: skippedCount
  });

  return {
    recipientsCount: recipients.length,
    sentCount,
    failedCount,
    skippedCount
  };
}
