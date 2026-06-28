import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { PollStatus } from "@prisma/client";
import { generateSealedPdf } from "@/lib/pdf";
import { tallyQuestion } from "@/lib/engine";
import { createAuditLogEntry } from "@/lib/hashChain";
import crypto from "crypto";
import fs from "fs";
import path from "path";

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

    // 2. Fetch the poll
    const poll = await db.poll.findUnique({
      where: { id: pollId },
      include: { questions: true }
    });

    if (!poll) {
      return NextResponse.json({ error: "Hlasovanie nebolo nájdené." }, { status: 404 });
    }

    if (poll.status !== PollStatus.active) {
      return NextResponse.json({ error: "Hlasovanie už bolo uzavreté alebo je v stave draft." }, { status: 400 });
    }

    // 3. Update poll status to closed
    await db.poll.update({
      where: { id: pollId },
      data: { status: PollStatus.closed }
    });

    // 4. Generate final results tally for serialization
    const finalResults = [];
    for (const q of poll.questions) {
      const tally = await tallyQuestion(pollId, q.id);
      finalResults.push({
        questionNo: q.no,
        title: q.title,
        agree: tally.agree,
        disagree: tally.disagree,
        abstain: tally.abstain,
        none: tally.none,
        disputed: tally.disputed,
        total: tally.total,
        need: tally.need,
        status: tally.status
      });
    }

    // 5. Generate PDF protocol
    const pdfBuffer = await generateSealedPdf(pollId);

    // 6. Calculate cryptographic SHA-256 seal
    const sha256 = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

    // 7. Save PDF to private server storage
    const storageDir = path.join(process.cwd(), "storage", "sealed");
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    const relativePdfPath = `/storage/sealed/${pollId}_zapisnica.pdf`;
    const absolutePdfPath = path.join(storageDir, `${pollId}_zapisnica.pdf`);
    
    fs.writeFileSync(absolutePdfPath, pdfBuffer);

    // 8. Write to SealedResult
    await db.sealedResult.create({
      data: {
        pollId,
        resultJson: JSON.stringify(finalResults),
        sha256,
        pdfPath: relativePdfPath,
        sealedAt: new Date()
      }
    });

    // 9. Add Audit Trail entry
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

    return NextResponse.json({ success: true, sha256 });
  } catch (err) {
    console.error("Close poll API error:", err);
    return NextResponse.json({ error: "Nepodarilo sa uzavrieť hlasovanie." }, { status: 500 });
  }
}
