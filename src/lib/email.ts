import { randomUUID } from "node:crypto";
import { db } from "./db";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

const EMAIL_BATCH_SIZE = 5;
const EMAIL_BATCH_INTERVAL_MS = 5000;
const RESEND_MAX_ATTEMPTS = 4;
const RESEND_MAX_WAIT_MS = 30_000;

interface EmailSchedule {
  tail: Promise<void>;
  batchStartedAt: number;
  batchCount: number;
  blockedUntil: number;
}

// Route bundles and development reloads share the limiter in this Node process.
const globalForEmail = globalThis as typeof globalThis & {
  hlasujmeEmailSchedule?: EmailSchedule;
};

function getEmailSchedule(): EmailSchedule {
  return globalForEmail.hlasujmeEmailSchedule ??= {
    tail: Promise.resolve(), batchStartedAt: 0, batchCount: 0, blockedUntil: 0,
  };
}

class ResendCooldownError extends Error {
  constructor() {
    super("Resend cooldown exceeds the request wait budget");
    this.name = "ResendCooldownError";
  }
}

async function pacedEmailFetch(url: string, options: RequestInit): Promise<Response> {
  const schedule = getEmailSchedule();
  const previous = schedule.tail;
  let release!: () => void;
  schedule.tail = new Promise<void>(resolve => { release = resolve; });
  try {
    await previous;
    // Recheck after waking: another response may have extended the cooldown.
    for (;;) {
      const nextBatchAt = schedule.batchCount >= EMAIL_BATCH_SIZE
        ? schedule.batchStartedAt + EMAIL_BATCH_INTERVAL_MS : 0;
      const waitMs = Math.max(nextBatchAt, schedule.blockedUntil) - Date.now();
      if (waitMs > RESEND_MAX_WAIT_MS) throw new ResendCooldownError();
      if (waitMs <= 0) break;
      await new Promise<void>(resolve => setTimeout(resolve, waitMs));
    }
    // Start each batch from the actual clock, so delayed timers cannot collapse batches.
    const now = Date.now();
    if (!schedule.batchCount || now >= schedule.batchStartedAt + EMAIL_BATCH_INTERVAL_MS) {
      schedule.batchStartedAt = now;
      schedule.batchCount = 0;
    }
    schedule.batchCount++;
    return fetch(url, { ...options, signal: AbortSignal.timeout(15_000) });
  } finally {
    // Only serialize request starts; a slow or rejected fetch cannot block this queue.
    release();
  }
}

function retryAfterMs(value: string | null, attempt: number): number {
  if (value?.trim()) {
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
    const date = Date.parse(value);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return 1000 * 2 ** attempt;
}

function safeErrorCode(value: unknown): string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value) ? value : "unknown_error";
}

async function providerErrorCode(response: Response, provider: "resend" | "postmark"): Promise<string> {
  try {
    const body = await response.json();
    if (provider === "resend") return safeErrorCode(body?.name);
    return Number.isInteger(body?.ErrorCode) ? `postmark_${body.ErrorCode}` : "unknown_error";
  } catch {
    return "invalid_error_response";
  }
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  const provider = process.env.EMAIL_PROVIDER || "resend";
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM || "info@hlasujme.sk";

  // Bypass sending in development if API key is a dummy or missing
  if (!apiKey || apiKey.startsWith("re_mock_") || apiKey.startsWith("pm_mock_")) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Email Service] Message was not sent", { to, reason: "production_email_not_configured" });
      return false;
    }
    console.log(`[Email Service] MOCK mode — email to ${to} not sent (no API key configured).`);
    return true;
  }

  try {
    if (provider.toLowerCase() === "resend") {
      const options: RequestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html
        })
      };
      for (let attempt = 0; attempt < RESEND_MAX_ATTEMPTS; attempt++) {
        const response = await pacedEmailFetch("https://api.resend.com/emails", options);
        if (response.ok) return true;
        const reason = await providerErrorCode(response, "resend");
        if (response.status === 429 && reason === "rate_limit_exceeded") {
          const waitMs = retryAfterMs(response.headers.get("retry-after"), attempt);
          const schedule = getEmailSchedule();
          schedule.blockedUntil = Math.max(schedule.blockedUntil, Date.now() + waitMs);
          if (attempt + 1 < RESEND_MAX_ATTEMPTS && waitMs <= RESEND_MAX_WAIT_MS) {
            console.warn("[Email Service] Resend request will retry", { to, reason, attempt: attempt + 1, waitMs });
            continue;
          }
        }
        console.error("[Email Service] Resend request failed", { to, status: response.status, reason, attempts: attempt + 1 });
        return false;
      }
      return false;
    } else if (provider.toLowerCase() === "postmark") {
      const response = await pacedEmailFetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Postmark-Server-Token": apiKey
        },
        body: JSON.stringify({
          From: from,
          To: to,
          Subject: subject,
          HtmlBody: html
        })
      });

      if (!response.ok) {
        const reason = await providerErrorCode(response, "postmark");
        console.error("[Email Service] Postmark request failed", { to, status: response.status, reason });
        return false;
      }
      return true;
    } else {
      console.warn("[Email Service] Unsupported email provider", { to, reason: "unsupported_provider" });
      return false;
    }
  } catch (err) {
    console.error("[Email Service] Email request failed", { to, reason: err instanceof Error ? safeErrorCode(err.name) : "unknown_error" });
    return false;
  }
}

// Templates helper
export function applyEmailStyles(html: string): string {
  // 1. Wrap the entire content in the main container style
  let styled = `<div style="font-family: sans-serif; color: #1B2330; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #E5DFD3; border-radius: 12px; background: #F4F1EA;">${html}</div>`;

  // 2. Replace class and tag selectors with inline styles
  styled = styled
    .replace(/<h2>/g, '<h2 style="font-family: Georgia, serif; color: #1F3A5F; margin-top: 0; font-size: 18px; font-weight: 600; border-bottom: 2px solid #1F3A5F; padding-bottom: 8px;">')
    .replace(/<\/h2>/g, '</h2>')
    .replace(/<h3>/g, '<h3 style="margin-top: 0; color: #1F3A5F; font-size: 15px; font-weight: 600; margin-bottom: 8px;">')
    .replace(/<\/h3>/g, '</h3>')
    .replace(/<div class="box">/g, '<div style="background: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #E5DFD3; margin: 15px 0; font-size: 13.5px;">')
    .replace(/<a class="btn" href="([^"]+)">/g, '<a href="$1" style="background-color: #1F3A5F; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 13.5px;">')
    .replace(/<p class="note">/g, '<p style="font-size: 12px; color: #606673; line-height: 1.4; margin: 10px 0 0;">')
    .replace(/<p class="meta">/g, '<p style="margin: 0 0 8px; color: #5C6473; font-size: 13.5px; line-height: 1.4;">')
    .replace(/<p class="warn">/g, '<p style="font-size: 13px; color: #b91c1c; font-weight: 600; line-height: 1.5; background: #fffbeb; border: 1px solid #fef3c7; padding: 10px 12px; border-radius: 6px; margin: 18px 0;">')
    .replace(/<code class="pass">/g, '<code style="font-family: monospace; font-size: 15px; color: #b91c1c; font-weight: bold; background: #fee2e2; padding: 2px 6px; border-radius: 4px;">')
    .replace(/<p>/g, '<p style="font-size: 14px; line-height: 1.5; color: #334155; margin: 10px 0;">');

  return styled;
}

export interface ConfirmationEmailParams {
  ownerName: string;
  unitNo: string;
  buildingShort: string;
  pollTitle: string;
  dateFormatted: string;
  answersSummary: { qNo: number; qTitle: string; answerText: string }[];
}

export function renderConfirmationEmail(
  template: EmailTemplateContent,
  params: ConfirmationEmailParams,
) {
  const answersListHtml = params.answersSummary
    .map(
      a => `
      <li style="margin-bottom: 8px;">
        <strong>Otázka ${a.qNo}:</strong> ${a.qTitle} <br/>
        Odpoveď: <span style="font-weight: bold; color: ${
          a.answerText === "Súhlasím" ? "#2E7D5B" : a.answerText === "Nesúhlasím" ? "#B23A48" : "#6B6254"
        }">${a.answerText}</span>
      </li>
    `
    )
    .join("");

  const replaceAll = (value: string) => value
    .replace(/{ownerName}/g, params.ownerName)
    .replace(/{unitNo}/g, params.unitNo)
    .replace(/{buildingShort}/g, params.buildingShort)
    .replace(/{pollTitle}/g, params.pollTitle)
    .replace(/{dateFormatted}/g, params.dateFormatted)
    .replace(/{answersList}/g, answersListHtml);

  return {
    subject: replaceAll(template.subject),
    html: applyEmailStyles(replaceAll(template.body)),
  };
}

export async function getConfirmationEmail(params: ConfirmationEmailParams) {
  const template = await db.emailTemplate.findUnique({
    where: { key: "confirmation" }
  });

  let subject = "Potvrdenie o hlasovaní: {pollTitle}";
  let body = `<h2>Potvrdenie o hlasovaní</h2>
<p>Vážený vlastník <strong>{ownerName}</strong>,</p>
<p>potvrdzujeme prijatie Vášho hlasu za byt/NP <strong>č. {unitNo}</strong> v hlasovaní:</p>

<div class="box">
  <h3>{pollTitle}</h3>
  <p class="meta"><strong>Prijaté dňa:</strong> {dateFormatted}</p>
  <ul style="padding-left: 20px; margin: 0; font-size: 13.5px; line-height: 1.5; color: #5C6473;">
    {answersList}
  </ul>
</div>

<p>Váš hlas bol bezpečne zaznamenaný a zašifrovaný v auditnom logu. Do uzávierky môžete svoje rozhodnutie zmeniť opätovným otvorením Vášho magic-linku v pôvodnom e-maile.</p>`;

  if (template) {
    subject = template.subject;
    body = template.body;
  }

  return renderConfirmationEmail({ subject, body }, params);
}

export async function getReminderEmail(params: {
  ownerName: string;
  buildingName: string;
  pollTitle: string;
  endFormatted: string;
  magicLink: string;
}) {
  const template = await db.emailTemplate.findUnique({
    where: { key: "reminder" }
  });

  let subject = "UPOZORNENIE: Pripomienka k hlasovaniu: {pollTitle}";
  let body = `<h2>Pripomienka k elektronickému hlasovaniu</h2>
<p>Vážený vlastník <strong>{ownerName}</strong>,</p>
<p>pripomíname Vám prebiehajúce elektronické hlasovanie v dome <strong>{buildingName}</strong>, ktoré končí o 48 hodín:</p>

<div class="box">
  <h3>{pollTitle}</h3>
  <p class="meta"><strong>Koniec hlasovania:</strong> do {endFormatted}</p>
</div>

<p>Ak ste doteraz neodovzdali svoj hlas, môžete tak urobiť kliknutím na odkaz nižšie:</p>

<div style="text-align: center; margin: 25px 0;">
  <a class="btn" href="{magicLink}">👉 HLASOVAŤ ELEKTRONICKY</a>
</div>`;

  if (template) {
    subject = template.subject;
    body = template.body;
  }

  const replaceAll = (str: string) => {
    return str
      .replace(/{ownerName}/g, params.ownerName)
      .replace(/{buildingName}/g, params.buildingName)
      .replace(/{pollTitle}/g, params.pollTitle)
      .replace(/{endFormatted}/g, params.endFormatted)
      .replace(/{magicLink}/g, params.magicLink);
  };

  return {
    subject: replaceAll(subject),
    html: applyEmailStyles(replaceAll(body))
  };
}


export async function getInvitationEmail(params: {
  ownerName: string;
  buildingName: string;
  pollTitle: string;
  pollReason: string;
  endFormatted: string;
  magicLink: string;
}) {
  const template = await db.emailTemplate.findUnique({
    where: { key: "invitation" }
  });

  let subject = "Pozvánka na hlasovanie: {pollTitle}";
  let body = `<h2>Pozvánka na elektronické hlasovanie</h2>
<p>Vážený vlastník <strong>{ownerName}</strong>,</p>
<p>v bytovom dome <strong>{buildingName}</strong> bolo vyhlásené elektronické hlasovanie:</p>

<div class="box">
  <h3>{pollTitle}</h3>
  <p class="meta"><strong>Dôvod:</strong> {pollReason}</p>
  <p class="meta"><strong>Termín na hlasovanie:</strong> do {endFormatted}</p>
</div>

<p>Pre hlasovanie použite Váš osobný bezpečnostný odkaz (magic link) nižšie. Nikomu tento odkaz neposielajte, slúži ako Vaša jednoznačná identifikácia:</p>

<div style="text-align: center; margin: 25px 0;">
  <a class="btn" href="{magicLink}">👉 HLASOVAŤ ELEKTRONICKY</a>
</div>

<p class="note">
  Poznámka: Za byt sa počíta jeden hlas (v prípade spoluvlastníctva podľa nahláseného režimu). Hlasovanie prebieha v zmysle zákona č. 182/1993 Z. z. Svoj hlas môžete do skončenia hlasovania kedykoľvek zmeniť kliknutím na tento odkaz — započíta sa posledné odoslané hlasovanie.
</p>`;

  if (template) {
    subject = template.subject;
    body = template.body;
  }

  const replaceAll = (str: string) => {
    return str
      .replace(/{ownerName}/g, params.ownerName)
      .replace(/{buildingName}/g, params.buildingName)
      .replace(/{pollTitle}/g, params.pollTitle)
      .replace(/{pollReason}/g, params.pollReason)
      .replace(/{endFormatted}/g, params.endFormatted)
      .replace(/{magicLink}/g, params.magicLink);
  };

  return {
    subject: replaceAll(subject),
    html: applyEmailStyles(replaceAll(body))
  };
}

export interface ProtocolEmailParams {
  ownerName: string;
  buildingName: string;
  pollTitle: string;
  protocolLink: string;
}

export interface EmailTemplateContent {
  subject: string;
  body: string;
}

/** Loads the protocol email template once — reuse it for all recipients. */
export async function getProtocolEmailTemplate(): Promise<EmailTemplateContent> {
  const template = await db.emailTemplate.findUnique({
    where: { key: "protocol" }
  });

  let subject = "Výsledok hlasovania: {pollTitle}";
  let body = `<h2>Výsledok hlasovania</h2>
<p>Vážený vlastník <strong>{ownerName}</strong>,</p>
<p>oznamujeme Vám, že elektronické hlasovanie bolo ukončené a výsledky boli oficiálne zapečatené:</p>

<div class="box">
  <h3>{pollTitle}</h3>
  <p class="meta"><strong>Stav:</strong> Uzavreté a overené</p>
  <p class="meta"><strong>Zápisnica (PDF):</strong> Na stiahnutie kliknutím na odkaz nižšie</p>
</div>

<p>Kompletnú zápisnicu o priebehu a výsledkoch si môžete stiahnuť aj priamo kliknutím na odkaz nižšie (odkaz nevyžaduje prihlásenie):</p>

<div style="text-align: center; margin: 25px 0;">
  <a class="btn" href="{protocolLink}">Stiahnuť zápisnicu (PDF)</a>
</div>`;

  if (template) {
    subject = template.subject;
    body = template.body;
  }

  return { subject, body };
}

/** Renders the protocol email for one recipient from an already-loaded template. */
export function renderProtocolEmail(template: EmailTemplateContent, params: ProtocolEmailParams) {
  const replaceAll = (str: string) => {
    return str
      .replace(/{ownerName}/g, params.ownerName)
      .replace(/{buildingName}/g, params.buildingName)
      .replace(/{pollTitle}/g, params.pollTitle)
      .replace(/{protocolLink}/g, params.protocolLink);
  };

  return {
    subject: replaceAll(template.subject),
    html: applyEmailStyles(replaceAll(template.body))
  };
}

export async function getProtocolEmail(params: ProtocolEmailParams) {
  const template = await getProtocolEmailTemplate();
  return renderProtocolEmail(template, params);
}

export async function getCredentialsEmail(params: {
  ownerName: string;
  buildingName: string;
  buildingShort: string;
  loginLink: string;
  loginEmail: string;
  rawPassword: string;
}) {
  const template = await db.emailTemplate.findUnique({
    where: { key: "credentials" }
  });

  let subject = "Prihlasovacie údaje: Bytový dom {buildingShort}";
  let body = `<h2>Prihlasovacie údaje k hlasovaciemu systému</h2>
<p>Dobrý deň, <strong>{ownerName}</strong>,</p>
<p>administrátor bytového domu <strong>{buildingName}</strong> Vám vygeneroval prístup do klientskej zóny hlasovacieho systému, kde si môžete kedykoľvek prečítať a stiahnuť výsledky hlasovaní.</p>

<div class="box">
  <p class="meta"><strong>Prihlasovacia stránka:</strong> <a href="{loginLink}">{loginLink}</a></p>
  <p class="meta"><strong>Prihlasovací e-mail:</strong> {loginEmail}</p>
  <p class="meta"><strong>Prihlasovacie heslo:</strong> <code class="pass">{rawPassword}</code></p>
</div>

<p class="warn">
  ⚠️ Dôležité upozornenie: Pri prvom prihlásení Vás systém vyzve na zmenu tohto automaticky vygenerovaného hesla za Vaše vlastné bezpečné heslo.
</p>

<p class="note">
  Tento e-mail bol odoslaný automaticky. Neodpovedajte naň.
</p>`;

  if (template) {
    subject = template.subject;
    body = template.body;
  }

  const replaceAll = (str: string) => {
    return str
      .replace(/{ownerName}/g, params.ownerName)
      .replace(/{buildingName}/g, params.buildingName)
      .replace(/{buildingShort}/g, params.buildingShort)
      .replace(/{loginLink}/g, params.loginLink)
      .replace(/{loginEmail}/g, params.loginEmail)
      .replace(/{rawPassword}/g, params.rawPassword);
  };

  return {
    subject: replaceAll(subject),
    html: applyEmailStyles(replaceAll(body))
  };
}
