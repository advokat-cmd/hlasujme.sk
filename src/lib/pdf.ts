import PDFDocument from "pdfkit";
import { computePollResults, EffectiveVote } from "./engine";
import { setupPdfFonts } from "./pdfFonts";
import type { Prisma } from "@prisma/client";
import { createSealedSnapshot, type SealedPollSnapshot } from "./seal";

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
  snapshot: SealedPollSnapshot;
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

/** Reserve at least 90 points per question so even the longest answer fits. */
export function createAnnexQuestionGroups<T>(questions: T[]): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < questions.length; index += 3) groups.push(questions.slice(index, index + 3));
  return groups;
}

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
export async function generateSealedProtocol(pollId: string, client?: Prisma.TransactionClient): Promise<SealedProtocol> {
  // treatAsClosed: sealing happens before the poll status flips to closed,
  // so undecided questions must resolve as rejected, not "short".
  const pollResults = await computePollResults(pollId, {
    treatAsClosed: true
  }, client);
  const { poll, units, tallies, effectiveVotes } = pollResults;
  const snapshot = createSealedSnapshot(pollResults);

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

    const { t, useBold: setBold, useRegular: setRegular } = setupPdfFonts(doc);
    const bold = (txt: string) => {
      setBold();
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
    doc.text(t("Vyhlasovateľ: "), { continued: true }).text(bold(poll.declarer)); setRegular();
    doc.text(t("Začiatok hlasovania: "), { continued: true }).text(bold(poll.startAt.toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" }))); setRegular();
    doc.text(t("Koniec hlasovania: "), { continued: true }).text(bold(poll.endAt.toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" }))); setRegular();
    doc.text(t("Status hlasovania: "), { continued: true }).text(bold("Uzavreté a zapečatené")); setRegular();
    doc.text(t("Zverejnené dňa: "), { continued: true }).text(bold(new Date(snapshot.sealedAt).toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" }))); setRegular();
    doc.moveDown(1.5);

    doc.fontSize(13);
    doc.text(bold("VÝSLEDKY HLASOVANIA PODĽA OTÁZOK")); setRegular();
    doc.moveDown(0.5);

    // Questions results
    for (const r of results) {
      doc.fontSize(11);
      doc.text(bold(`Otázka č. ${r.no} (${r.kind})`)); setRegular();
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

    // Annex: at most three question columns per group. Each group repeats all
    // units, so a longer poll never squeezes or overlaps answers on the page.
    const questionGroups = createAnnexQuestionGroups(poll.questions.map((question, index) => ({ question, index })));
    const colStartX = 270;
    const colEndX = 540;
    for (const group of questionGroups) {
      const colWidth = (colEndX - colStartX) / group.length;
      const colX = (index: number) => colStartX + index * colWidth;
      const cell = (width: number) => ({ width, height: 12, ellipsis: true, lineBreak: false });
      const startAnnexPage = (): number => {
        doc.addPage();
        doc.fontSize(13).text(bold("PRÍLOHA Č. 1: MENNÝ ZOZNAM HLASOVANIA JEDNOTIEK"), 50, 50); setRegular();
        doc.fontSize(10).text(t(`Otázky: ${group.map(({ question }) => question.no).join(", ")}`), 50, doc.y + 5);
        doc.moveDown(0.5);
        doc.fontSize(9);
        const y = doc.y;
        doc.text(bold("Jedn."), 50, y, cell(35));
        doc.text(bold("Vlastník / Režim"), 90, y, cell(170));
        group.forEach(({ question }, index) => {
          doc.text(bold(`Otázka ${question.no}`), colX(index), y, cell(colWidth - 5));
        });
        doc.strokeColor("#E5DFD3").lineWidth(1).moveTo(50, y + 12).lineTo(colEndX, y + 12).stroke();
        setRegular();
        return y + 18;
      };

      let currentY = startAnnexPage();
      for (const unitVote of unitVotes) {
        if (currentY > doc.page.height - doc.page.margins.bottom - 30) currentY = startAnnexPage();
        doc.text(t(unitVote.no), 50, currentY, cell(35));
        doc.text(t(`${unitVote.ownerName} (${unitVote.coMode})`), 90, currentY, cell(170));
        group.forEach(({ index: answerIndex }, columnIndex) => {
          const answer = unitVote.answers[answerIndex];
          const color = answer === "ZA" ? "#2E7D5B" : answer === "PROTI" ? "#B23A48" : answer === "Sporný" ? "#B07D2B" : "#5C6473";
          doc.fillColor(color).text(t(answer), colX(columnIndex), currentY, cell(colWidth - 5));
        });
        doc.fillColor("#1B2330");
        doc.strokeColor("#ECE7DC").lineWidth(0.5).moveTo(50, currentY + 10).lineTo(colEndX, currentY + 10).stroke();
        currentY += 16;
      }
    }

    doc.end();
  });

  return { buffer, results: finalResults, snapshot };
}

/** Backward-compatible wrapper returning only the PDF buffer. */
export async function generateSealedPdf(pollId: string): Promise<Buffer> {
  const { buffer } = await generateSealedProtocol(pollId);
  return buffer;
}
