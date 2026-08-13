import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { PollStatus } from "@prisma/client";
import { generateSealedProtocol } from "@/lib/pdf";
import { createAuditLogEntry } from "@/lib/hashChain";
import fs from "fs";
import path from "path";
import { acquirePollLock } from "@/lib/pollLock";
import { canonicalJson, sha256Hex } from "@/lib/seal";
import { resolveStoragePath, storageRelativePath } from "@/lib/storage";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Check admin session
    const session = await getAdminSession();
    if (!session || session.role === "vlastnik") {
      return NextResponse.json({ error: "Nedostatočné oprávnenia." }, { status: 403 });
    }

    const { id: pollId } = await params;

    // 2. Fetch the poll with building details
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

    if (poll.sealedResult) {
      return NextResponse.json({ success: true, sha256: poll.sealedResult.sha256, alreadySealed: true });
    }

    if (poll.status !== PollStatus.active && poll.status !== PollStatus.closing) {
      return NextResponse.json({ error: "Hlasovanie už bolo uzavreté alebo je v stave draft." }, { status: 400 });
    }

    // Stop new votes under the same lock used by vote transactions. A retry may
    // continue a previous interrupted close from the `closing` state.
    await db.$transaction(async tx => {
      await acquirePollLock(tx, pollId);
      const current = await tx.poll.findUnique({ where: { id: pollId }, include: { sealedResult: true } });
      if (!current || current.sealedResult) return;
      if (current.status === PollStatus.active) {
        await tx.poll.update({ where: { id: pollId }, data: { status: PollStatus.closing } });
      } else if (current.status !== PollStatus.closing) {
        throw new Error("POLL_NOT_CLOSABLE");
      }
    });

    // 3. Generate the sealed PDF + final results FIRST — if this fails, the
    // poll stays active and the admin can retry safely.
    let pdfBuffer: Buffer;
    let finalResults: unknown;
    try {
      const protocol = await generateSealedProtocol(pollId);
      pdfBuffer = protocol.buffer;
      finalResults = protocol.results;
    } catch (pdfErr) {
      console.error("Sealed PDF generation failed:", pdfErr);
      if (poll.endAt > new Date()) {
        await db.$transaction(async tx => {
          await acquirePollLock(tx, pollId);
          await tx.poll.updateMany({ where: { id: pollId, status: PollStatus.closing }, data: { status: PollStatus.active } });
        });
      }
      return NextResponse.json(
        { error: "Generovanie PDF zápisnice zlyhalo. Uzatvorenie môžete bezpečne zopakovať." },
        { status: 500 }
      );
    }

    // 4. Calculate cryptographic SHA-256 seal
    const sha256 = sha256Hex(pdfBuffer);
    const resultJson = canonicalJson(finalResults);
    const resultSha256 = sha256Hex(resultJson);

    // 5. Save PDF to private server storage (ASCII filename — used in
    // Content-Disposition headers; pollId prefix prevents same-day collisions)
    const dateToUse = new Date(poll.endAt < new Date() ? poll.endAt : new Date());
    const year = dateToUse.getFullYear();
    const month = String(dateToUse.getMonth() + 1).padStart(2, "0");
    const day = String(dateToUse.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;
    const fileName = `zapisnica-${formattedDate}-${pollId.slice(0, 8)}.pdf`;

    const absolutePdfPath = resolveStoragePath(`sealed/${fileName}`);
    const storageDir = path.dirname(absolutePdfPath);
    const relativePdfPath = storageRelativePath(absolutePdfPath);

    try {
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      fs.writeFileSync(absolutePdfPath, pdfBuffer);
    } catch (fsErr) {
      console.error("Failed to persist sealed PDF to storage:", fsErr);
      if (poll.endAt > new Date()) {
        await db.$transaction(async tx => {
          await acquirePollLock(tx, pollId);
          await tx.poll.updateMany({ where: { id: pollId, status: PollStatus.closing }, data: { status: PollStatus.active } });
        });
      }
      return NextResponse.json(
        { error: "Uloženie PDF zápisnice zlyhalo. Uzatvorenie môžete bezpečne zopakovať." },
        { status: 500 }
      );
    }

    // 7. Close the poll and seal the exact snapshot under the poll lock.
    const sealedResult = await db.$transaction(async tx => {
      await acquirePollLock(tx, pollId);
      const existing = await tx.sealedResult.findUnique({ where: { pollId } });
      if (existing) return existing;
      const current = await tx.poll.findUnique({ where: { id: pollId } });
      if (!current || current.status !== PollStatus.closing) throw new Error("POLL_NOT_CLOSABLE");
      const sealed = await tx.sealedResult.create({
        data: {
          pollId,
          resultJson,
          resultSha256,
          sha256,
          pdfPath: relativePdfPath,
          sealedAt: new Date()
        }
      });
      await tx.poll.update({ where: { id: pollId }, data: { status: PollStatus.closed } });
      return sealed;
    });

    // 8. Add Audit Trail entry
    await createAuditLogEntry(
      "POLL_CLOSED",
      `admin:${session.email}`,
      {
        message: `Hlasovanie "${poll.title}" bolo úspešne uzavreté a výsledky boli zapečatené.`,
        pollId,
        pollTitle: poll.title,
        sha256,
        pdfPath: relativePdfPath
      }
    );

    // Results are NOT emailed here — the admin sends them explicitly from the
    // protocol tab once the sealed local result is available.
    return NextResponse.json({
      success: true,
      sha256: sealedResult.sha256,
      resultSha256: sealedResult.resultSha256
    });
  } catch (err) {
    console.error("Close poll API error:", err);
    return NextResponse.json({ error: "Nepodarilo sa uzavrieť hlasovanie." }, { status: 500 });
  }
}
