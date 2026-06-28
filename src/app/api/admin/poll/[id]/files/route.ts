import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { listFilesInFolder, createDriveFolder } from "@/lib/gdrive";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Neprihlásený administrátor." }, { status: 401 });
    }

    const { id: pollId } = await params;
    const poll = await db.poll.findUnique({
      where: { id: pollId },
    });

    if (!poll) {
      return NextResponse.json({ error: "Hlasovanie nebolo nájdené." }, { status: 404 });
    }

    let folderId = poll.driveFolderId;
    if (!folderId) {
      // Create folder on the fly for legacy polls
      const dateString = poll.startAt.toISOString().split("T")[0];
      const folderName = `Podklady-hlasovanie-${dateString}`;
      folderId = await createDriveFolder(folderName);
      if (folderId) {
        await db.poll.update({
          where: { id: pollId },
          data: { driveFolderId: folderId },
        });
      }
    }

    if (!folderId) {
      // If Google Drive integration is not configured
      return NextResponse.json({ files: [] });
    }

    const files = await listFilesInFolder(folderId);
    return NextResponse.json({ files });
  } catch (err) {
    console.error("Error fetching files:", err);
    return NextResponse.json({ error: "Chyba pri načítaní súborov z Google Drive." }, { status: 500 });
  }
}
