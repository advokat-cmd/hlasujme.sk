import { NextResponse } from "next/server";
import { hashToken } from "@/lib/tokens";
import { db } from "@/lib/db";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Chýba hlasovací token." }, { status: 400 });
    }

    const tokenHash = hashToken(token);

    // 1. Fetch token record, relaxed validation (allow downloading receipt even if poll is closed/expired)
    const tokenRecord = await db.voteToken.findUnique({
      where: { tokenHash },
      include: {
        poll: {
          include: { questions: { orderBy: { no: "asc" } } }
        },
        unit: {
          include: { owners: true }
        }
      }
    });

    if (!tokenRecord) {
      return NextResponse.json({ error: "Neplatný odkaz na hlasovanie." }, { status: 404 });
    }

    const { poll, unit } = tokenRecord;

    let owner = null;
    if (tokenRecord.ownerId) {
      owner = unit.owners.find(o => o.id === tokenRecord.ownerId) || null;
    }

    // 2. Fetch voter's latest answers
    const answers: Record<number, string> = {};
    let lastVoteDate: Date | null = null;
    let lastVoteIp = "unknown";

    if (owner) {
      const subvotes = await db.coownerSubvote.findMany({
        where: { pollId: poll.id, unitId: unit.id, ownerId: owner.id },
        orderBy: [{ questionNo: "asc" }, { version: "desc" }]
      });
      const latestMap = new Map<number, { answer: string; date: Date; ip: string }>();
      for (const sv of subvotes) {
        if (!latestMap.has(sv.questionNo)) {
          latestMap.set(sv.questionNo, { answer: sv.answer, date: sv.createdAt, ip: sv.sourceIp || "unknown" });
        }
      }
      latestMap.forEach((v, qNo) => {
        answers[qNo] = v.answer;
        if (!lastVoteDate || v.date > lastVoteDate) {
          lastVoteDate = v.date;
          lastVoteIp = v.ip;
        }
      });
    } else {
      const votes = await db.vote.findMany({
        where: { pollId: poll.id, unitId: unit.id },
        orderBy: [{ questionNo: "asc" }, { version: "desc" }]
      });
      const latestMap = new Map<number, { answer: string; date: Date; ip: string }>();
      for (const v of votes) {
        if (!latestMap.has(v.questionNo)) {
          latestMap.set(v.questionNo, { answer: v.answer, date: v.createdAt, ip: v.sourceIp || "unknown" });
        }
      }
      latestMap.forEach((v, qNo) => {
        answers[qNo] = v.answer;
        if (!lastVoteDate || v.date > lastVoteDate) {
          lastVoteDate = v.date;
          lastVoteIp = v.ip;
        }
      });
    }

    if (Object.keys(answers).length === 0 || !lastVoteDate) {
      return NextResponse.json({ error: "Zatiaľ nebol odoslaný žiadny hlas pre tento odkaz." }, { status: 400 });
    }

    const voterName = owner ? owner.name : (unit.actingPerson || unit.owners[0]?.name || "Vlastník");

    // 3. Generate PDF receipt
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      // Register Arial fonts
      const fontPath = "C:\\Windows\\Fonts\\arial.ttf";
      const fontBoldPath = "C:\\Windows\\Fonts\\arialbd.ttf";

      if (fs.existsSync(fontPath)) {
        doc.registerFont("Arial", fontPath);
        doc.font("Arial");
      }
      if (fs.existsSync(fontBoldPath)) {
        doc.registerFont("Arial-Bold", fontBoldPath);
      }

      const bold = (txt: string) => {
        if (fs.existsSync(fontBoldPath)) doc.font("Arial-Bold");
        return txt;
      };
      
      const regular = () => {
        if (fs.existsSync(fontPath)) doc.font("Arial");
      };

      // Header
      doc.fontSize(16).text("POTVRDENIE O ELEKTRONICKOM HLASOVANÍ", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(11).text(poll.title, { align: "center" });
      doc.moveDown(1.5);

      // Metadata box
      doc.fontSize(10);
      doc.text("Bytový dom: ", { continued: true }).text(bold("Björnsonova 3, Bratislava")); regular();
      doc.text("Jednotka: ", { continued: true }).text(bold(`Byt č. ${unit.no}`)); regular();
      doc.text("Hlasujúci: ", { continued: true }).text(bold(voterName)); regular();
      
      if (owner) {
        doc.text("Hlasovací podiel: ", { continued: true }).text(bold(`${(owner.share * 100).toFixed(2)}% (spoluvlastnícky hlas)`)); regular();
      } else {
        doc.text("Hlasovací podiel: ", { continued: true }).text(bold(`1.00 (celý byt / zástupca)`)); regular();
      }

      doc.text("Čas prijatia: ", { continued: true }).text(bold(lastVoteDate!.toLocaleString("sk-SK"))); regular();
      doc.text("IP adresa: ", { continued: true }).text(bold(lastVoteIp)); regular();
      doc.moveDown(1.5);

      doc.fontSize(11);
      doc.text(bold("ZAZNAMENANÉ ODPOVEDE:")); regular();
      doc.moveDown(0.5);

      // Render answers list
      for (const q of poll.questions) {
        const choice = answers[q.no];
        let choiceText = "NEHLASOVANÉ";
        let choiceColor = "#5C6473";

        if (choice === "agree") {
          choiceText = "SÚHLASÍM (ZA)";
          choiceColor = "#2E7D5B";
        } else if (choice === "disagree") {
          choiceText = "NESÚHLASÍM (PROTI)";
          choiceColor = "#B23A48";
        } else if (choice === "abstain") {
          choiceText = "ZDRŽAL SA (NECHCEM HLASOVAŤ)";
          choiceColor = "#6B6254";
        }

        doc.fontSize(10);
        doc.text(bold(`Otázka č. ${q.no}`)); regular();
        doc.text(q.title, { indent: 10 });
        doc.fontSize(9).fillColor("#5C6473").text(q.text, { indent: 10 });
        doc.moveDown(0.2);
        doc.fontSize(10).fillColor(choiceColor).text(`Odpoveď: ${choiceText}`, { indent: 10 });
        doc.fillColor("#1B2330");
        doc.moveDown(1);
      }

      // Verification seal
      doc.moveDown(1.5);
      doc.fontSize(8).fillColor("#5C6473");
      
      const verificationPayload = JSON.stringify({
        tokenHash,
        unitNo: unit.no,
        voterName,
        answers,
        submittedAt: lastVoteDate!.toISOString()
      });
      const verificationHash = crypto.createHash("sha256").update(verificationPayload).digest("hex");

      doc.text("------------------------------------------------------------------------------------------------------", { align: "center" });
      doc.moveDown(0.5);
      doc.text("Tento dokument slúži ako elektronické potvrdenie o úspešnom odoslaní a zaevidovaní Vášho hlasu v systéme hlasovanie.sk.", { align: "center" });
      doc.text(`Kryptografický overovací kód: ${verificationHash}`, { align: "center" });
      doc.end();
    });

    const fileName = `potvrdenie_hlasovania_byt_${unit.no}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`
      }
    });

  } catch (err) {
    console.error("Voter receipt PDF error:", err);
    return NextResponse.json({ error: "Chyba pri generovaní potvrdenia." }, { status: 500 });
  }
}
