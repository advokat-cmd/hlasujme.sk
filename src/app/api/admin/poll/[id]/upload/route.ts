import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { uploadFileToDrive, createDriveFolder } from "@/lib/gdrive";
import { createAuditLogEntry } from "@/lib/hashChain";

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
    });

    if (!poll) {
      return NextResponse.json({ error: "Hlasovanie nebolo nájdené." }, { status: 404 });
    }

    // Parse multipart form-data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Súbor nebol nájdený v požiadavke." }, { status: 400 });
    }

    let folderId = poll.driveFolderId;
    if (!folderId) {
      // Create folder on the fly if it does not exist
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
      return NextResponse.json({ error: "Google Drive integrácia nie je nakonfigurovaná." }, { status: 500 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Google Drive
    const uploadedFile = await uploadFileToDrive(
      folderId,
      file.name,
      file.type,
      buffer
    );

    if (!uploadedFile) {
      return NextResponse.json({ error: "Nahrávanie súboru na Google Drive zlyhalo." }, { status: 500 });
    }

    // Log the file upload event
    await createAuditLogEntry("FILE_UPLOADED", `admin:${session.email}`, {
      message: `Nahraný podkladový súbor "${file.name}" k hlasovaniu.`,
      pollId,
      fileName: file.name,
      fileId: uploadedFile.id,
    });

    return NextResponse.json({ success: true, file: uploadedFile });
  } catch (err) {
    console.error("Error during file upload:", err);
    return NextResponse.json({ error: "Chyba pri spracovaní nahrávania súboru." }, { status: 500 });
  }
}
