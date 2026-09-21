import { applyEmailStyles } from "./email";
import type { SealedPollSnapshot } from "./seal";

export const POLL_CLOSURE_NOTIFICATION_EMAIL = "milan@ficek.sk";

const statusLabels: Record<SealedPollSnapshot["questions"][number]["tally"]["status"], string> = {
  approved: "Schválené",
  rejected: "Neschválené",
  short: "Nedosiahnutá väčšina",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailSubject(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function formatSealedAt(value: string): string {
  return new Intl.DateTimeFormat("sk-SK", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Bratislava",
  }).format(new Date(value));
}

export function renderPollClosureNotification(snapshot: SealedPollSnapshot, adminLink: string) {
  const questions = snapshot.questions.map(question => {
    const { tally } = question;
    return `
      <div class="box">
        <h3>${question.no}. ${escapeHtml(question.title)}</h3>
        <p><strong>${statusLabels[tally.status]}</strong></p>
        <p>ZA: <strong>${tally.agree}</strong> · PROTI: <strong>${tally.disagree}</strong> · ZDRŽAL SA: <strong>${tally.abstain}</strong></p>
        <p>Účasť: <strong>${tally.voted} z ${tally.total}</strong> hlasov · Nehlasovalo: <strong>${tally.none}</strong> · Sporné: <strong>${tally.disputed}</strong></p>
        <p class="meta">Na schválenie bolo potrebných ${tally.need} hlasov ZA.</p>
      </div>`;
  }).join("");

  const building = snapshot.poll.building;
  const buildingName = building.short || building.name;
  const html = applyEmailStyles(`
    <h2>Hlasovanie bolo uzavreté</h2>
    <p>Dobrý deň, Milan,</p>
    <p>hlasovanie <strong>${escapeHtml(snapshot.poll.title)}</strong> pre dom <strong>${escapeHtml(buildingName)}</strong> bolo uzavreté a výsledky boli zapečatené.</p>
    <p class="meta">Stav: uzavreté · ${escapeHtml(formatSealedAt(snapshot.sealedAt))}</p>
    ${questions}
    <p><a class="btn" href="${escapeHtml(adminLink)}">Otvoriť hlasovanie v administrácii</a></p>
    <p class="note">Vlastníkom nebola automaticky odoslaná zápisnica ani výsledky. Ak ich chcete rozoslať, môžete to urobiť ručne v záložke Zápisnica.</p>
  `);

  return {
    subject: `Hlasovanie uzavreté: ${emailSubject(snapshot.poll.title)}`,
    html,
  };
}
