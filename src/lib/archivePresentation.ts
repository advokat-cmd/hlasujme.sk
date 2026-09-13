import { getSealedQuestionTallies, parseSealedSnapshot } from "./seal";

export function archiveSummary(seal: { resultJson: string; resultSha256?: string | null } | null) {
  if (!seal) return { label: "zápisnica chýba", tone: "neutral" as const, turnoutText: "—" };
  try {
    const questions = getSealedQuestionTallies(seal.resultJson, seal.resultSha256);
    const snapshot = parseSealedSnapshot(seal.resultJson, seal.resultSha256);
    const approved = questions.filter(question => question.tally.status === "approved").length;
    const participated = snapshot?.units.filter(unit => unit.effectiveVotes.some(vote => vote.answer !== null || vote.disputed)).length ?? 0;
    return {
      label: questions.length ? `schválené otázky: ${approved} / ${questions.length}` : "pozri zápisnicu",
      tone: approved === questions.length && questions.length > 0 ? "success" as const : "neutral" as const,
      turnoutText: snapshot?.units.length ? `${Math.round(participated / snapshot.units.length * 100)} % jednotiek` : "pozri zápisnicu",
    };
  } catch {
    return { label: "výsledky nemožno overiť", tone: "danger" as const, turnoutText: "—" };
  }
}
