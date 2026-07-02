import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { PollStatus } from "@prisma/client";
import { generateSealedProtocol } from "@/lib/pdf";
import { createAuditLogEntry } from "@/lib/hashChain";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { uploadFileToDrive } from "@/lib/gdrive";

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

    if (poll.status !== PollStatus.active) {
      return NextResponse.json({ error: "Hlasovanie už bolo uzavreté alebo je v stave draft." }, { status: 400 });
    }

    if (poll.sealedResult) {
      return NextResponse.json({ error: "Zápisnica pre toto hlasovanie už existuje." }, { status: 400 });
    }

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
      return NextResponse.json(
        { error: "Generovanie PDF zápisnice zlyhalo — hlasovanie NEBOLO uzavreté. Skúste to znova." },
        { status: 500 }
      );
    }

    // 4. Calculate cryptographic SHA-256 seal
    const sha256 = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

    // 5. Save PDF to private server storage (ASCII filename — used in
    // Content-Disposition headers; pollId prefix prevents same-day collisions)
    const dateToUse = new Date(poll.endAt < new Date() ? poll.endAt : new Date());
    const year = dateToUse.getFullYear();
    const month = String(dateToUse.getMonth() + 1).padStart(2, "0");
    const day = String(dateToUse.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;
    const fileName = `zapisnica-${formattedDate}-${pollId.slice(0, 8)}.pdf`;

    const storageDir = path.join(process.cwd(), "storage", "sealed");
    const relativePdfPath = `/storage/sealed/${fileName}`;
    const absolutePdfPath = path.join(storageDir, fileName);

    try {
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      fs.writeFileSync(absolutePdfPath, pdfBuffer);
    } catch (fsErr) {
      console.error("Failed to persist sealed PDF to storage:", fsErr);
      return NextResponse.json(
        { error: "Uloženie PDF zápisnice na server zlyhalo — hlasovanie NEBOLO uzavreté." },
        { status: 500 }
      );
    }

    // 6. Upload to Google Drive. A failure does not block the close (the PDF
    // is safely stored locally), but it is tracked and reported to the admin.
    const driveConfigured = !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
    let driveFile: { id: string; webViewLink: string } | null = null;
    let driveErrorMessage: string | null = null;

    if (!poll.driveFolderId) {
      driveErrorMessage = driveConfigured
        ? "Hlasovanie nemá priradený Google Drive priečinok."
        : null;
    } else {
      try {
        driveFile = await uploadFileToDrive(poll.driveFolderId, fileName, "application/pdf", pdfBuffer);
        if (!driveFile && driveConfigured) {
          driveErrorMessage = "Nahratie zápisnice na Google Drive zlyhalo.";
        }
      } catch (driveErr) {
        console.error("Failed to upload sealed PDF to Google Drive:", driveErr);
        driveErrorMessage = "Nahratie zápisnice na Google Drive zlyhalo.";
      }
    }

    // 7. Close the poll and seal the result atomically
    await db.$transaction([
      db.poll.update({
        where: { id: pollId },
        data: { status: PollStatus.closed }
      }),
      db.sealedResult.create({
        data: {
          pollId,
          resultJson: JSON.stringify(finalResults),
          sha256,
          pdfPath: relativePdfPath,
          sealedAt: new Date(),
          driveFileId: driveFile?.id ?? null,
          driveWebViewLink: driveFile?.webViewLink ?? null,
          driveUploadedAt: driveFile ? new Date() : null
        }
      })
    ]);

    // 8. Add Audit Trail entry
    await createAuditLogEntry(
      "POLL_CLOSED",
      `admin:${session.email}`,
      {
        message: `Hlasovanie "${poll.title}" bolo úspešne uzavreté a výsledky boli zapečatené.`,
        pollId,
        pollTitle: poll.title,
        sha256,
        pdfPath: relativePdfPath,
        driveFileId: driveFile?.id ?? null,
        driveUploadFailed: !!driveErrorMessage
      }
    );

    // Results are NOT emailed here — the admin sends them explicitly from the
    // protocol tab once the Drive backup is confirmed.
    return NextResponse.json({
      success: true,
      sha256,
      driveUploaded: !!driveFile,
      driveConfigured,
      driveError: driveErrorMessage
    });
  } catch (err) {
    console.error("Close poll API error:", err);
    return NextResponse.json({ error: "Nepodarilo sa uzavrieť hlasovanie." }, { status: 500 });
  }
}
