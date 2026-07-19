import { NextResponse } from "next/server";
import { hashToken } from "@/lib/tokens";
import { db } from "@/lib/db";
import PDFDocument from "pdfkit";
import crypto from "crypto";
import { setupPdfFonts } from "@/lib/pdfFonts";

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
          include: { owners: true, building: true }
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

    const voterName = owner
      ? owner.name
      : (unit.actingPerson || (unit.owners.length > 0 ? unit.owners.map(o => o.name).join(", ") : "Vlastník"));

    // 3. Generate PDF receipt
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      // Bundled fonts are cached per-process and preserve Slovak diacritics
      const { t: clean, useBold: setBold, useRegular: regular } = setupPdfFonts(doc);

      const boldClean = (txt: string) => {
        setBold();
        return clean(txt);
      };

      // Header
      doc.fontSize(16).text(clean("POTVRDENIE O ELEKTRONICKOM HLASOVANÍ"), { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(11).text(clean(poll.title), { align: "center" });
      doc.moveDown(1.5);

      doc.fontSize(10);
      const vchod = unit.building.short || unit.building.entrance || "";
      doc.text(clean("Vchod: "), { continued: true })
        .text(boldClean(vchod), { continued: true })
        .text(clean(", bytový dom: "), { continued: true })
        .text(boldClean(unit.building.address));
      regular();
      doc.text(clean("Jednotka: "), { continued: true }).text(boldClean(`Byt č. ${unit.no}`)); regular();
      doc.text(clean("Hlasujúci: "), { continued: true }).text(boldClean(voterName)); regular();
      
      if (owner) {
        doc.text(clean("Hlasovací podiel: "), { continued: true }).text(boldClean(`${(owner.share * 100).toFixed(2)}% (spoluvlastnícky hlas)`)); regular();
      } else {
        doc.text(clean("Hlasovací podiel: "), { continued: true }).text(boldClean(`1.00 (celý byt / zástupca)`)); regular();
      }

      doc.text(clean("Čas prijatia: "), { continued: true }).text(boldClean(lastVoteDate!.toLocaleString("sk-SK"))); regular();
      doc.text(clean("IP adresa: "), { continued: true }).text(boldClean(lastVoteIp)); regular();
      doc.moveDown(1.5);

      doc.fontSize(11);
      doc.text(boldClean("ZAZNAMENANÉ ODPOVEDE:")); regular();
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
        doc.text(boldClean(`Otázka č. ${q.no}`)); regular();
        doc.text(clean(q.text), { indent: 10 });
        doc.moveDown(0.2);
        doc.fontSize(10).fillColor(choiceColor).text(clean(`Odpoveď: ${choiceText}`), { indent: 10 });
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
      doc.text(clean("Tento dokument slúži ako elektronické potvrdenie o úspešnom odoslaní a zaevidovaní Vášho hlasu v systéme hlasujme.sk."), { align: "center" });
      doc.text(clean(`Kryptografický overovací kód: ${verificationHash}`), { align: "center" });
      doc.end();
    });

    const fileName = `potvrdenie_hlasovania_byt_${unit.no}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
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
