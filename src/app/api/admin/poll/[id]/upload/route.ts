import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { uploadFileToDrive, createDriveFolder } from "@/lib/gdrive";
import { createAuditLogEntry } from "@/lib/hashChain";
import fs from "fs";
import path from "path";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

function safeFileName(original: string): string {
  const ext = path.extname(original).toLowerCase().slice(0, 10);
  const base = path.basename(original, path.extname(original))
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "dokument";
  return `${Date.now()}-${base}${ext}`;
}

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

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Súbor je príliš veľký (max. 25 MB)." }, { status: 400 });
    }

    // Optional link to a question (used by the create-poll wizard)
    const questionNoRaw = formData.get("questionNo");
    const questionNo = questionNoRaw ? parseInt(String(questionNoRaw), 10) : null;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. PRIMARY: save the document on the server — voters must be able to
    // download it even when Google Drive is unavailable or not configured.
    const storedName = safeFileName(file.name);
    const uploadDir = path.join(process.cwd(), "storage", "uploads", pollId);
    const relativePath = `/storage/uploads/${pollId}/${storedName}`;

    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadDir, storedName), buffer);
    } catch (fsErr) {
      console.error("Failed to store uploaded document locally:", fsErr);
      return NextResponse.json({ error: "Uloženie súboru na server zlyhalo." }, { status: 500 });
    }

    // 2. BACKUP: best-effort upload to Google Drive
    let driveFile: { id: string; webViewLink: string } | null = null;
    try {
      let folderId = poll.driveFolderId;
      if (!folderId) {
        const dateString = poll.startAt.toISOString().split("T")[0];
        folderId = await createDriveFolder(`Podklady-hlasovanie-${dateString}`);
        if (folderId) {
          await db.poll.update({
            where: { id: pollId },
            data: { driveFolderId: folderId },
          });
        }
      }
      if (folderId) {
        driveFile = await uploadFileToDrive(folderId, file.name, file.type || "application/octet-stream", buffer);
      }
    } catch (driveErr) {
      console.error("Drive backup of uploaded document failed:", driveErr);
    }

    // 3. Register the document in the database
    const document = await db.pollDocument.create({
      data: {
        pollId,
        questionNo: questionNo && !Number.isNaN(questionNo) ? questionNo : null,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        localPath: relativePath,
        driveFileId: driveFile?.id ?? null,
        webViewLink: driveFile?.webViewLink ?? null,
      },
    });

    const downloadUrl = `/api/document/${document.id}`;

    // 4. If linked to a question, attach the download link to it
    if (questionNo && !Number.isNaN(questionNo)) {
      const question = await db.question.findFirst({
        where: { pollId, no: questionNo },
      });
      if (question) {
        await db.question.update({
          where: { id: question.id },
          data: { attachments: [...question.attachments, downloadUrl] },
        });
      }
    }

    await createAuditLogEntry("FILE_UPLOADED", `admin:${session.email}`, {
      message: `Nahraný podkladový súbor "${file.name}" k hlasovaniu.`,
      pollId,
      fileName: file.name,
      documentId: document.id,
      driveFileId: driveFile?.id ?? null,
      driveBackup: !!driveFile,
    });

    return NextResponse.json({
      success: true,
      driveBackup: !!driveFile,
      document: {
        id: document.id,
        name: document.name,
        mimeType: document.mimeType,
        url: downloadUrl,
        webViewLink: driveFile?.webViewLink ?? null,
      },
      // Backward-compatible shape for older callers
      file: {
        id: document.id,
        name: document.name,
        mimeType: document.mimeType,
        webViewLink: downloadUrl,
      },
    });
  } catch (err) {
    console.error("Error during file upload:", err);
    return NextResponse.json({ error: "Chyba pri spracovaní nahrávania súboru." }, { status: 500 });
  }
}
