import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import fs from "fs";
import path from "path";
import { downloadFileFromDrive, listFilesInFolder } from "@/lib/gdrive";
import { verifySealedPdfAccess } from "@/lib/protocolEmail";

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

    if (!session && !verifySealedPdfAccess(pollId, signature)) {
      return NextResponse.json({ error: "Prístup k zápisnici vyžaduje prihlásenie alebo platný odkaz z e-mailu." }, { status: 403 });
    }

    // 2. Fetch SealedResult record
    const sealedResult = await db.sealedResult.findUnique({
      where: { pollId }
    });

    if (!sealedResult) {
      return NextResponse.json({ error: "Zápisnica pre toto hlasovanie zatiaľ nebola vytvorená." }, { status: 404 });
    }

    // 3. Resolve the PDF: local storage first, Google Drive backup second
    const fileName = path.basename(sealedResult.pdfPath);
    const absolutePath = path.join(process.cwd(), "storage", "sealed", fileName);

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
        const pdfFile = files.find(f => f.name === fileName || f.name.endsWith(".pdf"));
        if (pdfFile) {
          fileBuffer = await downloadFileFromDrive(pdfFile.id);
        }
      }
    }

    if (!fileBuffer) {
      return NextResponse.json({ error: "Súbor zápisnice nebol nájdený." }, { status: 404 });
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
