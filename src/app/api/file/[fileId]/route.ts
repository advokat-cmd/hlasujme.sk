import { NextResponse } from "next/server";
import { downloadFileFromDrive, getFileMetadata } from "@/lib/gdrive";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;

    if (!fileId) {
      return NextResponse.json({ error: "Chýba ID súboru." }, { status: 400 });
    }

    // 1. Fetch metadata (filename, mimeType) from Google Drive
    const metadata = await getFileMetadata(fileId);
    if (!metadata) {
      return NextResponse.json({ error: "Súbor nebol nájdený na Google Drive." }, { status: 404 });
    }

    // 2. Download file buffer
    const fileBuffer = await downloadFileFromDrive(fileId);
    if (!fileBuffer) {
      return NextResponse.json({ error: "Nepodarilo sa stiahnuť súbor." }, { status: 500 });
    }

    // 3. Stream the file to the browser
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": metadata.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(metadata.name)}"`
      }
    });
  } catch (err) {
    console.error("Error serving file via proxy:", err);
    return NextResponse.json({ error: "Chyba pri sťahovaní súboru." }, { status: 500 });
  }
}
