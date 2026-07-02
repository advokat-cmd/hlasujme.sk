import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { createAuditLogEntry } from "@/lib/hashChain";
import { uploadFileToDrive, createDriveFolder } from "@/lib/gdrive";
import fs from "fs";
import path from "path";

/**
 * Re-uploads the sealed protocol PDF to Google Drive. Used when the upload
 * during poll close failed (Drive outage, missing folder, quota...).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session || session.role === "vlastnik") {
      return NextResponse.json({ error: "Nedostatočné oprávnenia." }, { status: 403 });
    }

    const { id: pollId } = await params;

    const poll = await db.poll.findUnique({
      where: { id: pollId },
      include: { sealedResult: true, building: true }
    });

    if (!poll || !poll.sealedResult) {
      return NextResponse.json({ error: "Zápisnica pre toto hlasovanie neexistuje." }, { status: 404 });
    }

    if (poll.sealedResult.driveFileId) {
      return NextResponse.json({ error: "Zápisnica už je nahratá na Google Drive." }, { status: 400 });
    }

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json({ error: "Google Drive nie je nakonfigurovaný (chýbajú prístupové údaje)." }, { status: 400 });
    }

    // Load the sealed PDF from local storage
    const fileName = path.basename(poll.sealedResult.pdfPath);
    const absolutePath = path.join(process.cwd(), "storage", "sealed", fileName);

    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: "Lokálny súbor zápisnice nebol nájdený, nahratie nie je možné." }, { status: 404 });
    }

    const pdfBuffer = fs.readFileSync(absolutePath);

    // Ensure the poll has a Drive folder
    let driveFolderId = poll.driveFolderId;
    if (!driveFolderId) {
      driveFolderId = await createDriveFolder(`${poll.building.name} — ${poll.title}`);
      if (driveFolderId) {
        await db.poll.update({
          where: { id: pollId },
          data: { driveFolderId }
        });
      }
    }

    if (!driveFolderId) {
      return NextResponse.json({ error: "Nepodarilo sa vytvoriť Google Drive priečinok." }, { status: 502 });
    }

    const driveFile = await uploadFileToDrive(driveFolderId, fileName, "application/pdf", pdfBuffer);
    if (!driveFile) {
      return NextResponse.json({ error: "Nahratie na Google Drive zlyhalo. Skúste to znova." }, { status: 502 });
    }

    await db.sealedResult.update({
      where: { pollId },
      data: {
        driveFileId: driveFile.id,
        driveWebViewLink: driveFile.webViewLink,
        driveUploadedAt: new Date()
      }
    });

    await createAuditLogEntry("PROTOCOL_DRIVE_UPLOADED", `admin:${session.email}`, {
      message: `Zápisnica hlasovania "${poll.title}" bola dodatočne nahratá na Google Drive.`,
      pollId,
      driveFileId: driveFile.id
    });

    return NextResponse.json({ success: true, driveFileId: driveFile.id, webViewLink: driveFile.webViewLink });
  } catch (err) {
    console.error("Retry drive upload error:", err);
    return NextResponse.json({ error: "Interná chyba pri nahrávaní na Google Drive." }, { status: 500 });
  }
}
