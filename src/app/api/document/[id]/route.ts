import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { downloadFileFromDrive } from "@/lib/gdrive";
import fs from "fs";
import path from "path";

/**
 * Serves a poll supporting document to voters and admins.
 * Local server storage is the primary source; Google Drive is the fallback.
 * Document IDs are unguessable UUIDs — same access model as the previous
 * public "anyone with the link" Drive sharing.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const document = await db.pollDocument.findUnique({
      where: { id },
    });

    if (!document) {
      return NextResponse.json({ error: "Dokument nebol nájdený." }, { status: 404 });
    }

    let fileBuffer: Buffer | null = null;

    if (document.localPath) {
      const absolutePath = path.join(process.cwd(), document.localPath.replace(/^\//, ""));
      if (fs.existsSync(absolutePath)) {
        fileBuffer = fs.readFileSync(absolutePath);
      }
    }

    if (!fileBuffer && document.driveFileId) {
      fileBuffer = await downloadFileFromDrive(document.driveFileId);
    }

    if (!fileBuffer) {
      return NextResponse.json({ error: "Súbor dokumentu nebol nájdený." }, { status: 404 });
    }

    const asciiName = document.name.normalize("NFD").replace(/[^\x20-\x7E]/g, "") || "dokument";

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(document.name)}`,
        "Cache-Control": "private, max-age=300"
      }
    });
  } catch (err) {
    console.error("Error serving poll document:", err);
    return NextResponse.json({ error: "Chyba pri sťahovaní dokumentu." }, { status: 500 });
  }
}
