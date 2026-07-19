import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { uploadFileToDrive, createDriveFolder } from "@/lib/gdrive";
import { createAuditLogEntry } from "@/lib/hashChain";
import fs from "fs";
import path from "path";
import { randomUUID } from "node:crypto";
import { hasValidDocumentSignature, isAllowedDocument } from "@/lib/security/documents";
import { resolveStoragePath, storageRelativePath } from "@/lib/storage";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

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
    const mimeType = file.type.toLowerCase();
    if (!isAllowedDocument(mimeType, file.name)) {
      return NextResponse.json({ error: "Tento typ súboru nie je povolený." }, { status: 400 });
    }

    // Optional link to a question (used by the create-poll wizard)
    const questionNoRaw = formData.get("questionNo");
    const questionNo = questionNoRaw ? parseInt(String(questionNoRaw), 10) : null;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!hasValidDocumentSignature(mimeType, buffer)) {
      return NextResponse.json({ error: "Obsah súboru nezodpovedá deklarovanému typu." }, { status: 400 });
    }

    // 1. PRIMARY: save the document on the server — voters must be able to
    // download it even when Google Drive is unavailable or not configured.
    const storedName = `${randomUUID()}${path.extname(file.name).toLowerCase()}`;
    const absolutePath = resolveStoragePath(`uploads/${pollId}/${storedName}`);
    const uploadDir = path.dirname(absolutePath);
    const relativePath = storageRelativePath(absolutePath);

    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      fs.writeFileSync(absolutePath, buffer);
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
        driveFile = await uploadFileToDrive(folderId, file.name, mimeType, buffer);
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
        mimeType,
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
