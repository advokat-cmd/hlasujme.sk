import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canReadBuilding, getAdminSession } from "@/lib/session";
import { validateVoteToken } from "@/lib/tokens";
import { readStoredFile } from "@/lib/storage";

/**
 * Serves a poll supporting document to voters and admins.
 * Persistent server storage is the sole file source.
 * Access requires an administrator, an owner linked to the poll's building,
 * or a valid voting token for this poll.
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
      plainToken ? validateVoteToken(plainToken, { allowBeforeStart: true }) : Promise.resolve(null),
    ]);
    const authorized = voter?.poll.id === document.pollId
      || await canReadBuilding(session, document.poll.buildingId);
    if (!authorized) {
      return NextResponse.json({ error: "Na stiahnutie dokumentu nemáte oprávnenie." }, { status: 403 });
    }

    const fileBuffer = document.localPath ? readStoredFile(document.localPath) : null;

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
