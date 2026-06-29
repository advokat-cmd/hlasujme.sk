import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import fs from "fs";
import path from "path";
import { listFilesInFolder, downloadFileFromDrive } from "@/lib/gdrive";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    const { pollId } = await params;

    // 2. Fetch SealedResult record
    const sealedResult = await db.sealedResult.findUnique({
      where: { pollId }
    });

    if (!sealedResult) {
      return NextResponse.json({ error: "Zápisnica pre toto hlasovanie zatiaľ nebola vytvorená." }, { status: 404 });
    }

    // 3. Resolve absolute file path
    // sealedResult.pdfPath has format: "/storage/sealed/[pollId]_zapisnica.pdf"
    const fileName = path.basename(sealedResult.pdfPath);
    const absolutePath = path.join(process.cwd(), "storage", "sealed", fileName);

    let fileBuffer: Buffer | null = null;

    if (fs.existsSync(absolutePath)) {
      fileBuffer = fs.readFileSync(absolutePath);
    } else {
      // Fallback: download from Google Drive if available
      const poll = await db.poll.findUnique({
        where: { id: pollId }
      });
      if (poll?.driveFolderId) {
        const files = await listFilesInFolder(poll.driveFolderId);
        const pdfFile = files.find(f => f.name.endsWith("_zapisnica.pdf"));
        if (pdfFile) {
          fileBuffer = await downloadFileFromDrive(pdfFile.id);
        }
      }
    }

    if (!fileBuffer) {
      return NextResponse.json({ error: "Súbor zápisnice nebol nájdený." }, { status: 404 });
    }

    // 4. Return PDF stream response
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`
      }
    });
  } catch (err) {
    console.error("Download PDF API error:", err);
    return NextResponse.json({ error: "Chyba pri sťahovaní zápisnice." }, { status: 500 });
  }
}
