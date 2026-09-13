import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { createAuditLogEntryWithTx } from "@/lib/hashChain";
import fs from "fs";
import path from "path";
import { randomUUID } from "node:crypto";
import { hasValidDocumentSignature, isAllowedDocument } from "@/lib/security/documents";
import { resolveStoragePath, storageRelativePath } from "@/lib/storage";
import { acquirePollLock } from "@/lib/pollLock";
import { PollConflict } from "@/lib/pollLifecycle";

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
    if (poll.status !== "draft") return NextResponse.json({ error: "Podklady možno meniť iba v návrhu pred vyhlásením hlasovania." }, { status: 409 });

    // Parse multipart form-data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!(file instanceof File)) {
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
    const questionNo = questionNoRaw === null || questionNoRaw === "" ? null : Number(questionNoRaw);
    if (questionNo !== null && (!Number.isSafeInteger(questionNo) || questionNo < 1)) {
      return NextResponse.json({ error: "Neplatné číslo otázky." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!hasValidDocumentSignature(mimeType, buffer)) {
      return NextResponse.json({ error: "Obsah súboru nezodpovedá deklarovanému typu." }, { status: 400 });
    }

    // 1. PRIMARY: save the document on the server — voters must be able to
    // download it from the persistent server storage.
    const storedName = `${randomUUID()}${path.extname(file.name).toLowerCase()}`;
    const absolutePath = resolveStoragePath(`uploads/${pollId}/${storedName}`);
    const uploadDir = path.dirname(absolutePath);
    const relativePath = storageRelativePath(absolutePath);

    // Register the document in the database.
    const document = await db.$transaction(async tx => {
      await acquirePollLock(tx, pollId);
      const current = await tx.poll.findUnique({ where: { id: pollId } });
      if (!current || current.status !== "draft") throw new PollConflict("Podklady možno meniť iba v návrhu pred vyhlásením hlasovania.");
      const question = questionNo === null ? null : await tx.question.findUnique({ where: { pollId_no: { pollId, no: questionNo } } });
      if (questionNo !== null && !question) throw new PollConflict("Otázka nepatrí k tomuto hlasovaniu.");
      fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(absolutePath, buffer, { flag: "wx" });
      const created = await tx.pollDocument.create({
      data: {
        pollId,
        questionNo,
        name: file.name,
        mimeType,
        size: file.size,
        localPath: relativePath,
      },
      });
      if (question) await tx.question.update({ where: { id: question.id }, data: { attachments: { push: `/api/document/${created.id}` } } });
      await createAuditLogEntryWithTx(tx, "FILE_UPLOADED", `admin:${session.email}`, {
        message: `Nahraný podkladový súbor "${file.name}" k hlasovaniu.`, pollId, fileName: file.name, documentId: created.id,
      });
      return created;
    });

    const downloadUrl = `/api/document/${document.id}`;

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        name: document.name,
        mimeType: document.mimeType,
        url: downloadUrl,
        webViewLink: downloadUrl,
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
    if (err instanceof PollConflict) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error("Error during file upload:", err);
    return NextResponse.json({ error: "Chyba pri spracovaní nahrávania súboru." }, { status: 500 });
  }
}
