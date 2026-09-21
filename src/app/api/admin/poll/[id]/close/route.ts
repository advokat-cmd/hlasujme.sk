import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { generateSealedProtocol } from "@/lib/pdf";
import { createAuditLogEntry, createAuditLogEntryWithTx } from "@/lib/hashChain";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { acquirePollLock } from "@/lib/pollLock";
import { lockBuilding, PollConflict } from "@/lib/pollLifecycle";
import { canonicalJson, sha256Hex } from "@/lib/seal";
import { resolveStoragePath, storageRelativePath } from "@/lib/storage";
import { sendEmail } from "@/lib/email";
import {
  POLL_CLOSURE_NOTIFICATION_EMAIL,
  renderPollClosureNotification,
} from "@/lib/pollClosureNotification";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAdminSession();
    if (!session || session.role === "vlastnik") return NextResponse.json({ error: "Nedostatočné oprávnenia." }, { status: 403 });
    const { id: pollId } = await params;
    const target = await db.poll.findUnique({ where: { id: pollId }, select: { buildingId: true } });
    if (!target) return NextResponse.json({ error: "Hlasovanie nebolo nájdené." }, { status: 404 });

    // Keep the vote lock through snapshot generation, PDF persistence and commit.
    const actor = "admin:" + session.email;
    const closure = await db.$transaction(async tx => {
      await lockBuilding(tx, target.buildingId);
      await acquirePollLock(tx, pollId);
      const poll = await tx.poll.findUnique({ where: { id: pollId }, include: { sealedResult: true } });
      if (!poll) throw new PollConflict("Hlasovanie už neexistuje.");
      if (poll.sealedResult) return { sealed: poll.sealedResult, snapshot: null, newlyClosed: false };
      if (poll.status !== "active" && poll.status !== "closing") throw new PollConflict("Uzatvoriť možno iba vyhlásené hlasovanie.");
      await tx.poll.update({ where: { id: pollId }, data: { status: "closing" } });
      const protocol = await generateSealedProtocol(pollId, tx);
      const sha256 = sha256Hex(protocol.buffer);
      const resultJson = canonicalJson(protocol.snapshot);
      const resultSha256 = sha256Hex(resultJson);
      const fileName = "zapisnica-" + new Date().toISOString().slice(0, 10) + "-" + pollId + "-" + randomUUID() + ".pdf";
      const absolutePath = resolveStoragePath("sealed/" + fileName);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, protocol.buffer, { flag: "wx" });
      const result = await tx.sealedResult.create({ data: {
        pollId, resultJson, resultSha256, sha256,
        pdfPath: storageRelativePath(absolutePath), sealedAt: new Date(),
      } });
      await tx.poll.update({ where: { id: pollId }, data: { status: "closed" } });
      await createAuditLogEntryWithTx(tx, "POLL_CLOSED", actor, {
        message: 'Hlasovanie "' + poll.title + '" bolo uzavreté a výsledky zapečatené.',
        pollId, pollTitle: poll.title, sha256, resultSha256, pdfPath: result.pdfPath,
      });
      await createAuditLogEntryWithTx(tx, "POLL_CLOSED_ADMIN_NOTIFICATION_QUEUED", actor, {
        message: "Informačný e-mail o uzavretí hlasovania bol zaradený na odoslanie.",
        pollId, email: POLL_CLOSURE_NOTIFICATION_EMAIL,
      });
      return { sealed: result, snapshot: protocol.snapshot, newlyClosed: true };
    }, { maxWait: 10000, timeout: 60000 });

    let notificationStatus: "sent" | "failed" | "not-needed" = "not-needed";
    if (closure.newlyClosed && closure.snapshot) {
      const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
      const adminLink = `${baseUrl}/admin/poll/${encodeURIComponent(pollId)}?tab=results`;
      try {
        const message = renderPollClosureNotification(closure.snapshot, adminLink);
        const sent = await sendEmail({ to: POLL_CLOSURE_NOTIFICATION_EMAIL, ...message });
        notificationStatus = sent ? "sent" : "failed";
        try {
          await createAuditLogEntry(
            sent ? "POLL_CLOSED_ADMIN_NOTIFICATION_SENT" : "POLL_CLOSED_ADMIN_NOTIFICATION_FAILED",
            actor,
            {
              message: sent
                ? "Informačný e-mail o uzavretí hlasovania bol odoslaný."
                : "Informačný e-mail o uzavretí hlasovania sa nepodarilo odoslať.",
              pollId, email: POLL_CLOSURE_NOTIFICATION_EMAIL,
            },
          );
        } catch (auditError) {
          console.error("Close notification audit error:", auditError);
        }
      } catch (notificationError) {
        notificationStatus = "failed";
        console.error("Close notification error:", notificationError);
        try {
          await createAuditLogEntry("POLL_CLOSED_ADMIN_NOTIFICATION_FAILED", actor, {
            message: "Príprava informačného e-mailu o uzavretí hlasovania zlyhala.",
            pollId, email: POLL_CLOSURE_NOTIFICATION_EMAIL,
          });
        } catch (auditError) {
          console.error("Close notification audit error:", auditError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      sha256: closure.sealed.sha256,
      resultSha256: closure.sealed.resultSha256,
      notificationStatus,
      notificationRecipient: closure.newlyClosed ? POLL_CLOSURE_NOTIFICATION_EMAIL : null,
    });
  } catch (error) {
    if (error instanceof PollConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("Close poll API error:", error);
    return NextResponse.json({ error: "Uzatvorenie alebo uloženie zápisnice zlyhalo. Uzatvorenie môžete bezpečne zopakovať." }, { status: 500 });
  }
}
