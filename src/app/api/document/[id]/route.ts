import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { downloadFileFromDrive } from "@/lib/gdrive";
import fs from "fs";
import { getAdminSession } from "@/lib/session";
import { validateVoteToken } from "@/lib/tokens";
import { resolveStoragePath } from "@/lib/storage";

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
      include: { poll: true },
    });

    if (!document) {
      return NextResponse.json({ error: "Dokument nebol nájdený." }, { status: 404 });
    }

    const url = new URL(request.url);
    const plainToken = url.searchParams.get("token");
    const [session, voter] = await Promise.all([
      getAdminSession(),
      plainToken ? validateVoteToken(plainToken) : Promise.resolve(null),
    ]);
    let authorized = voter?.poll.id === document.pollId;
    if (session?.role === "admin" || session?.role === "superadmin") authorized = true;
    if (!authorized && session?.unitId) {
      const unit = await db.unit.findUnique({ where: { id: session.unitId }, select: { buildingId: true } });
      authorized = unit?.buildingId === document.poll.buildingId;
    }
    if (!authorized) {
      return NextResponse.json({ error: "Na stiahnutie dokumentu nemáte oprávnenie." }, { status: 403 });
    }

    let fileBuffer: Buffer | null = null;

    if (document.localPath) {
      const absolutePath = resolveStoragePath(document.localPath);
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
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(document.name)}`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (err) {
    console.error("Error serving poll document:", err);
    return NextResponse.json({ error: "Chyba pri sťahovaní dokumentu." }, { status: 500 });
  }
}
