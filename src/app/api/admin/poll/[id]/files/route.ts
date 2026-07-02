import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { listFilesInFolder } from "@/lib/gdrive";

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
      include: { documents: { orderBy: { createdAt: "asc" } } }
    });

    if (!poll) {
      return NextResponse.json({ error: "Hlasovanie nebolo nájdené." }, { status: 404 });
    }

    interface FileEntry {
      id: string;
      name: string;
      mimeType: string;
      webViewLink: string;
      driveWebViewLink: string | null;
      source: "local" | "drive";
    }

    // Primary source: documents registered in the database (server storage)
    const files: FileEntry[] = poll.documents.map(d => ({
      id: d.id,
      name: d.name,
      mimeType: d.mimeType,
      webViewLink: `/api/document/${d.id}`,
      driveWebViewLink: d.webViewLink,
      source: "local"
    }));

    // Legacy polls: documents uploaded before server storage existed live only
    // in the poll's Drive folder — merge them in (skip Drive copies of known docs).
    if (poll.driveFolderId) {
      const knownDriveIds = new Set(poll.documents.map(d => d.driveFileId).filter(Boolean));
      const driveFiles = await listFilesInFolder(poll.driveFolderId);
      for (const f of driveFiles) {
        if (!knownDriveIds.has(f.id)) {
          files.push({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            webViewLink: f.webViewLink,
            driveWebViewLink: f.webViewLink,
            source: "drive"
          });
        }
      }
    }

    return NextResponse.json({ files });
  } catch (err) {
    console.error("Error fetching files:", err);
    return NextResponse.json({ error: "Chyba pri načítaní súborov." }, { status: 500 });
  }
}
