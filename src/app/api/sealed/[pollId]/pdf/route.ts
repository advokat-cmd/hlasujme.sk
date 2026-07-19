import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import fs from "fs";
import path from "path";
import { downloadFileFromDrive, listFilesInFolder } from "@/lib/gdrive";
import { verifySealedPdfAccess } from "@/lib/protocolEmail";
import { resolveStoragePath } from "@/lib/storage";
import { verifySha256 } from "@/lib/seal";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    const { pollId } = await params;

    // 1. Authorization: either a logged-in user (admin/owner UI) or a signed
    // download link from the protocol email. The protocol contains names and
    // per-unit votes — it must not be downloadable by anyone guessing pollId.
    const url = new URL(request.url);
    const signature = url.searchParams.get("sig");
    const session = await getAdminSession();

    // 2. Fetch SealedResult record
    const sealedResult = await db.sealedResult.findUnique({
      where: { pollId },
      include: { poll: true },
    });

    if (!sealedResult) {
      return NextResponse.json({ error: "Zápisnica pre toto hlasovanie zatiaľ nebola vytvorená." }, { status: 404 });
    }
    let authorized = verifySealedPdfAccess(pollId, signature);
    if (session?.role === "admin" || session?.role === "superadmin") authorized = true;
    if (!authorized && session?.unitId) {
      const unit = await db.unit.findUnique({ where: { id: session.unitId }, select: { buildingId: true } });
      authorized = unit?.buildingId === sealedResult.poll.buildingId;
    }
    if (!authorized) {
      return NextResponse.json({ error: "Prístup k zápisnici vyžaduje oprávnený účet alebo platný odkaz z e-mailu." }, { status: 403 });
    }

    // 3. Resolve the PDF: local storage first, Google Drive backup second
    const fileName = path.basename(sealedResult.pdfPath);
    const absolutePath = resolveStoragePath(sealedResult.pdfPath);

    let fileBuffer: Buffer | null = null;

    if (fs.existsSync(absolutePath)) {
      fileBuffer = fs.readFileSync(absolutePath);
    } else if (sealedResult.driveFileId) {
      fileBuffer = await downloadFileFromDrive(sealedResult.driveFileId);
    } else {
      // Legacy fallback for protocols sealed before drive file tracking:
      // look the file up by name in the poll's Drive folder.
      const poll = await db.poll.findUnique({ where: { id: pollId } });
      if (poll?.driveFolderId) {
        const files = await listFilesInFolder(poll.driveFolderId);
        const pdfFile = files.find(f =>
          f.name === fileName ||
          (/z[áa]pisnica/i.test(f.name) && f.name.toLowerCase().endsWith(".pdf"))
        );
        if (pdfFile) {
          fileBuffer = await downloadFileFromDrive(pdfFile.id);
        }
      }
    }

    if (!fileBuffer) {
      return NextResponse.json({ error: "Súbor zápisnice nebol nájdený." }, { status: 404 });
    }
    if (!verifySha256(fileBuffer, sealedResult.sha256)) {
      return NextResponse.json({ error: "Integrita zapečatenej zápisnice bola porušená." }, { status: 409 });
    }

    // 4. Return PDF response (ASCII-safe filename fallback for the header)
    const asciiFileName = fileName.normalize("NFD").replace(/[^\x20-\x7E]/g, "") || "zapisnica.pdf";

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
      }
    });
  } catch (err) {
    console.error("Download PDF API error:", err);
    return NextResponse.json({ error: "Chyba pri sťahovaní zápisnice." }, { status: 500 });
  }
}
