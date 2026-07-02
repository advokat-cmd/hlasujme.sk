import PDFDocument from "pdfkit";
import { computePollResults, EffectiveVote } from "./engine";
import { setupPdfFonts } from "./pdfFonts";

export interface SealedQuestionResult {
  questionNo: number;
  title: string;
  agree: number;
  disagree: number;
  abstain: number;
  none: number;
  disputed: number;
  total: number;
  need: number;
  status: "approved" | "rejected" | "short";
}

export interface SealedProtocol {
  buffer: Buffer;
  results: SealedQuestionResult[];
}

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
  /** Answer label per question, in poll question order */
  answers: string[];
}

const EMPTY_EFFECTIVE: EffectiveVote = { answer: null, disputed: false, note: null };

function mapAnswerLabel(eff: EffectiveVote): string {
  if (eff.disputed) return "Sporný";
  if (eff.answer === "agree") return "ZA";
  if (eff.answer === "disagree") return "PROTI";
  if (eff.answer === "abstain") return "ZDRŽAL SA";
  return "NEHLASOVAL";
}

/**
 * Generates the sealed protocol PDF together with the machine-readable results.
 * All tallies are computed in a single batched pass (constant query count).
 */
export async function generateSealedProtocol(pollId: string): Promise<SealedProtocol> {
  // treatAsClosed: sealing happens before the poll status flips to closed,
  // so undecided questions must resolve as rejected, not "short".
  const { poll, units, tallies, effectiveVotes } = await computePollResults(pollId, {
    treatAsClosed: true
  });

  const building = poll.building;

  const finalResults: SealedQuestionResult[] = [];
  const results: QuestionResultDetails[] = [];

  for (const q of poll.questions) {
    const tally = tallies.get(q.no);
    if (!tally) continue;

    finalResults.push({
      questionNo: q.no,
      title: q.title,
      agree: tally.agree,
      disagree: tally.disagree,
      abstain: tally.abstain,
      none: tally.none,
      disputed: tally.disputed,
      total: tally.total,
      need: tally.need,
      status: tally.status
    });

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

  const unitVotes: UnitVoteDetails[] = units.map(u => {
    const perQuestion = effectiveVotes.get(u.id);
    const ownerName = u.coMode === "rep" && u.actingPerson
      ? u.actingPerson
      : (u.owners.map(o => o.name).join(", ") || "Vlastník");

    return {
      no: u.no,
      ownerName,
      coMode: u.coMode,
      answers: poll.questions.map(q => mapAnswerLabel(perQuestion?.get(q.no) || EMPTY_EFFECTIVE))
    };
  });

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    const { t, useBold, useRegular } = setupPdfFonts(doc);
    const bold = (txt: string) => {
      useBold();
      return t(txt);
    };

    // Header
    doc.fontSize(18).text(t("ZÁPISNICA O ELEKTRONICKOM HLASOVANÍ"), { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(t(building.name), { align: "center" });
    doc.text(t(building.address), { align: "center" });
    doc.moveDown(1.5);

    // Metadata section
    doc.fontSize(11);
    doc.text(t("Vyhlasovateľ: "), { continued: true }).text(bold(poll.declarer)); useRegular();
    doc.text(t("Začiatok hlasovania: "), { continued: true }).text(bold(poll.startAt.toLocaleString("sk-SK"))); useRegular();
    doc.text(t("Koniec hlasovania: "), { continued: true }).text(bold(poll.endAt.toLocaleString("sk-SK"))); useRegular();
    doc.text(t("Status hlasovania: "), { continued: true }).text(bold("Uzavreté a zapečatené")); useRegular();
    doc.text(t("Zverejnené dňa: "), { continued: true }).text(bold(new Date().toLocaleString("sk-SK"))); useRegular();
    doc.moveDown(1.5);

    doc.fontSize(13);
    doc.text(bold("VÝSLEDKY HLASOVANIA PODĽA OTÁZOK")); useRegular();
    doc.moveDown(0.5);

    // Questions results
    for (const r of results) {
      doc.fontSize(11);
      doc.text(bold(`Otázka č. ${r.no} (${r.kind})`)); useRegular();
      doc.text(t(r.text), { indent: 15 });
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
      doc.text(t(`Požadovaná väčšina: ${majLabel}`), { indent: 15 });
      doc.text(t(`Potrebné ZA: ${r.need} hlasov, Celkový počet hlasov v dome: ${r.total}`), { indent: 15 });

      doc.moveDown(0.2);
      doc.text(t(`Súhlasilo (ZA): ${r.agree}`), { indent: 15 });
      doc.text(t(`Nesúhlasilo (PROTI): ${r.disagree}`), { indent: 15 });
      doc.text(t(`Zdržalo sa: ${r.abstain}`), { indent: 15 });
      doc.text(t(`Nehlasovalo: ${r.none}`), { indent: 15 });
      doc.text(t(`Sporné: ${r.disputed}`), { indent: 15 });
      doc.moveDown(0.2);

      const statusColor = r.status === "Schválené" ? "#2E7D5B" : "#B23A48";
      doc.fillColor(statusColor).text(t(`Výsledok: ${r.status}`), { indent: 15, stroke: true });
      doc.fillColor("#1B2330");

      doc.moveDown(1.2);
    }

    // Annex: per-unit vote list
    doc.addPage();
    doc.fontSize(13);
    doc.text(bold("PRÍLOHA Č. 1: MENNÝ ZOZNAM HLASOVANIA JEDNOTIEK")); useRegular();
    doc.moveDown(0.5);

    doc.fontSize(9);

    // Question columns are laid out dynamically — only the questions that
    // were actually declared for this poll appear in the annex.
    const questionCount = poll.questions.length;
    const colStartX = 270;
    const colEndX = 540;
    const colWidth = questionCount > 0 ? (colEndX - colStartX) / questionCount : 0;
    const colX = (i: number) => colStartX + i * colWidth;

    const drawTableHeader = (y: number): number => {
      doc.text(bold("Jedn."), 50, y);
      doc.text(bold("Vlastník / Režim"), 90, y);
      poll.questions.forEach((q, i) => {
        doc.text(bold(`Otázka ${q.no}`), colX(i), y);
      });
      doc.strokeColor("#E5DFD3").lineWidth(1).moveTo(50, y + 12).lineTo(colEndX, y + 12).stroke();
      useRegular();
      return y + 18;
    };

    let currentY = drawTableHeader(doc.y);
    const pageBreakY = doc.page.height - doc.page.margins.bottom - 30;

    for (const uv of unitVotes) {
      if (currentY > pageBreakY) {
        doc.addPage();
        currentY = drawTableHeader(50);
      }

      doc.text(t(uv.no), 50, currentY);

      const truncatedName = uv.ownerName.length > 28 ? uv.ownerName.slice(0, 25) + "..." : uv.ownerName;
      doc.text(t(`${truncatedName} (${uv.coMode})`), 90, currentY);

      const getChoiceColor = (choice: string) => {
        if (choice === "ZA") return "#2E7D5B";
        if (choice === "PROTI") return "#B23A48";
        if (choice === "Sporný") return "#B07D2B";
        return "#5C6473";
      };

      uv.answers.forEach((answer, i) => {
        doc.fillColor(getChoiceColor(answer)).text(t(answer), colX(i), currentY);
      });
      doc.fillColor("#1B2330");

      doc.strokeColor("#ECE7DC").lineWidth(0.5).moveTo(50, currentY + 10).lineTo(colEndX, currentY + 10).stroke();

      currentY += 16;
    }

    doc.end();
  });

  return { buffer, results: finalResults };
}

/** Backward-compatible wrapper returning only the PDF buffer. */
export async function generateSealedPdf(pollId: string): Promise<Buffer> {
  const { buffer } = await generateSealedProtocol(pollId);
  return buffer;
}
