import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { db } from "./db";
import { tallyQuestion, getEffectiveUnitVote } from "./engine";
import { MajorityType } from "@prisma/client";

interface QuestionResultDetails {
  no: number;
  kind: string;
  title: string;
  text: string;
  majorityType: string;
  total: number;
  agree: number;
  disagree: number;
  abstain: number;
  none: number;
  disputed: number;
  voted: number;
  need: number;
  status: string;
}

interface UnitVoteDetails {
  no: string;
  ownerName: string;
  coMode: string;
  q1: string;
  q2: string;
  q3: string;
}

export async function generateSealedPdf(pollId: string): Promise<Buffer> {
  const poll = await db.poll.findUnique({
    where: { id: pollId },
    include: {
      building: true,
      questions: { orderBy: { no: "asc" } }
    }
  });

  if (!poll) {
    throw new Error(`Poll ${pollId} not found`);
  }

  const building = poll.building;

  // Calculate results for all questions
  const results: QuestionResultDetails[] = [];
  for (const q of poll.questions) {
    const tally = await tallyQuestion(pollId, q.id);
    results.push({
      no: q.no,
      kind: q.kind,
      title: q.title,
      text: q.text,
      majorityType: q.majorityType,
      total: tally.total,
      agree: tally.agree,
      disagree: tally.disagree,
      abstain: tally.abstain,
      none: tally.none,
      disputed: tally.disputed,
      voted: tally.voted,
      need: tally.need,
      status: tally.status === "approved" ? "Schválené" : tally.status === "rejected" ? "Neschválené" : "Nedosiahnutá väčšina"
    });
  }

  // Fetch unit list and vote choices for appendix
  const units = await db.unit.findMany({
    where: { buildingId: building.id },
    orderBy: { no: "asc" },
    include: { owners: true }
  });

  const unitVotes: UnitVoteDetails[] = [];
  const mapAns = (ans: string | null, disputed: boolean) => {
    if (disputed) return "Sporný";
    if (ans === "agree") return "ZA";
    if (ans === "disagree") return "PROTI";
    if (ans === "abstain") return "ZDRŽAL SA";
    return "NEHLASOVAL";
  };

  for (const u of units) {
    const v1 = await getEffectiveUnitVote(pollId, u.id, 1);
    const v2 = await getEffectiveUnitVote(pollId, u.id, 2);
    const v3 = await getEffectiveUnitVote(pollId, u.id, 3);

    const ownerName = u.coMode === "rep" && u.actingPerson 
      ? u.actingPerson 
      : (u.owners.map(o => o.name).join(", ") || "Vlastník");

    unitVotes.push({
      no: u.no,
      ownerName,
      coMode: u.coMode,
      q1: mapAns(v1.answer, v1.disputed),
      q2: mapAns(v2.answer, v2.disputed),
      q3: mapAns(v3.answer, v3.disputed)
    });
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    // Try project-bundled Roboto fonts first (cross-platform / Vercel compatible)
    let resolvedFont = path.join(process.cwd(), "public/fonts/Roboto-Regular.ttf");
    let resolvedFontBold = path.join(process.cwd(), "public/fonts/Roboto-Bold.ttf");

    if (!fs.existsSync(resolvedFont)) {
      // Fallback to Windows system Arial if running locally on Windows
      resolvedFont = "C:\\Windows\\Fonts\\arial.ttf";
      resolvedFontBold = "C:\\Windows\\Fonts\\arialbd.ttf";
    }

    const hasFont = fs.existsSync(resolvedFont);
    const hasFontBold = fs.existsSync(resolvedFontBold);

    if (hasFont) {
      doc.registerFont("CustomFont", resolvedFont);
      doc.font("CustomFont");
    }
    if (hasFontBold) {
      doc.registerFont("CustomFont-Bold", resolvedFontBold);
    }

    const bold = (txt: string) => {
      if (hasFontBold) doc.font("CustomFont-Bold");
      return txt;
    };
    
    const regular = () => {
      if (hasFont) doc.font("CustomFont");
    };

    // Header
    doc.fontSize(18).text("ZÁPISNICA O ELEKTRONICKOM HLASOVANÍ", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(building.name, { align: "center" });
    doc.text(building.address, { align: "center" });
    doc.moveDown(1.5);

    // Metadata section
    doc.fontSize(11);
    doc.text(`Vyhlasovateľ: `, { continued: true }).text(bold(poll.declarer)); regular();
    doc.text(`Začiatok hlasovania: `, { continued: true }).text(bold(poll.startAt.toLocaleString("sk-SK"))); regular();
    doc.text(`Koniec hlasovania: `, { continued: true }).text(bold(poll.endAt.toLocaleString("sk-SK"))); regular();
    doc.text(`Status hlasovania: `, { continued: true }).text(bold("Uzavreté a zapečatené")); regular();
    doc.text(`Zverejnené dňa: `, { continued: true }).text(bold(new Date().toLocaleString("sk-SK"))); regular();
    doc.moveDown(1.5);

    doc.fontSize(13);
    doc.text(bold("VÝSLEDKY HLASOVANIA PODĽA OTÁZOK")); regular();
    doc.moveDown(0.5);

    // Questions results
    for (const r of results) {
      doc.fontSize(11);
      doc.text(bold(`Otázka č. ${r.no} (${r.kind})`)); regular();
      doc.text(r.title, { indent: 15 });
      doc.fontSize(10).fillColor("#5C6473").text(r.text, { indent: 15 });
      doc.fillColor("#1B2330");
      doc.moveDown(0.3);

      const normalizedMaj = r.majorityType.replace("_", "-");
      const majLabel = normalizedMaj === "half-all" 
        ? "Nadpolovičná väčšina všetkých vlastníkov" 
        : normalizedMaj === "twothirds-all" 
        ? "Dvojtretinová väčšina všetkých vlastníkov" 
        : normalizedMaj === "fourfifths-all" 
        ? "Štvorpätinová väčšina všetkých vlastníkov" 
        : normalizedMaj === "all" 
        ? "Súhlas všetkých vlastníkov" 
        : "Nadpolovičná väčšina zúčastnených";

      doc.fontSize(10);
      doc.text(`Požadovaná väčšina: ${majLabel}`, { indent: 15 });
      doc.text(`Potrebné ZA: ${r.need} hlasov, Celkový počet hlasov v dome: ${r.total}`, { indent: 15 });
      
      const resultText = `Súhlasilo: ${r.agree} (ZA) · Nesúhlasilo: ${r.disagree} (PROTI) · Zdržalo sa: ${r.abstain} · Nehlasovalo: ${r.none} · Sporné: ${r.disputed}`;
      doc.text(resultText, { indent: 15 });
      
      const statusColor = r.status === "Schválené" ? "#2E7D5B" : "#B23A48";
      doc.fillColor(statusColor).text(`Výsledok: ${r.status}`, { indent: 15, stroke: true });
      doc.fillColor("#1B2330");
      
      doc.moveDown(1.2);
    }

    // Signatures / footer
    doc.addPage();
    doc.fontSize(13);
    doc.text(bold("PRÍLOHA Č. 1: MENNÝ ZOZNAM HLASOVANIA JEDNOTIEK")); regular();
    doc.moveDown(0.5);

    // Annex Table
    doc.fontSize(9);
    
    // Draw table header
    const startY = doc.y;
    doc.text(bold("Jedn."), 50, startY);
    doc.text(bold("Vlastník / Režim"), 90, startY);
    doc.text(bold("Otázka 1"), 270, startY);
    doc.text(bold("Otázka 2"), 340, startY);
    doc.text(bold("Otázka 3"), 410, startY);
    
    doc.strokeColor("#E5DFD3").lineWidth(1).moveTo(50, startY + 12).lineTo(500, startY + 12).stroke();
    regular();
    
    let currentY = startY + 18;

    for (const uv of unitVotes) {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
        doc.text(bold("Jedn."), 50, currentY);
        doc.text(bold("Vlastník / Režim"), 90, currentY);
        doc.text(bold("Otázka 1"), 270, currentY);
        doc.text(bold("Otázka 2"), 340, currentY);
        doc.text(bold("Otázka 3"), 410, currentY);
        doc.strokeColor("#E5DFD3").lineWidth(1).moveTo(50, currentY + 12).lineTo(500, currentY + 12).stroke();
        regular();
        currentY += 18;
      }

      doc.text(uv.no, 50, currentY);
      
      const truncatedName = uv.ownerName.length > 28 ? uv.ownerName.slice(0, 25) + "..." : uv.ownerName;
      doc.text(`${truncatedName} (${uv.coMode})`, 90, currentY);
      
      const getChoiceColor = (choice: string) => {
        if (choice === "ZA") return "#2E7D5B";
        if (choice === "PROTI") return "#B23A48";
        if (choice === "Sporný") return "#B07D2B";
        return "#5C6473";
      };

      doc.fillColor(getChoiceColor(uv.q1)).text(uv.q1, 270, currentY);
      doc.fillColor(getChoiceColor(uv.q2)).text(uv.q2, 340, currentY);
      doc.fillColor(getChoiceColor(uv.q3)).text(uv.q3, 410, currentY);
      doc.fillColor("#1B2330");

      doc.strokeColor("#ECE7DC").lineWidth(0.5).moveTo(50, currentY + 10).lineTo(500, currentY + 10).stroke();

      currentY += 16;
    }

    doc.end();
  });
}
