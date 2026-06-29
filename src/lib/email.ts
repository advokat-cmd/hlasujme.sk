import { db } from "./db";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  const provider = process.env.EMAIL_PROVIDER || "resend";
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM || "info@hlasujme.sk";

  console.log(`[Email Service] Sending email to ${to}... Subject: "${subject}"`);

  // Bypass sending in development if API key is a dummy or missing
  if (!apiKey || apiKey.startsWith("re_mock_") || apiKey.startsWith("pm_mock_")) {
    console.log(`[Email Service] MOCK mode enabled. Email contents:\n---\nTo: ${to}\nSubject: ${subject}\nBody: ${html.slice(0, 300)}...\n---`);
    return true;
  }

  try {
    if (provider.toLowerCase() === "resend") {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Resend API error: ${response.status} - ${errorText}`);
        return false;
      }
      return true;
    } else if (provider.toLowerCase() === "postmark") {
      const response = await fetch("https://api.postmarkapp.com/email", {
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
        const errorText = await response.text();
        console.error(`Postmark API error: ${response.status} - ${errorText}`);
        return false;
      }
      return true;
    } else {
      console.warn(`Unsupported email provider: ${provider}`);
      return false;
    }
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

// Templates helper
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export function getInvitationEmailHtml(
  ownerName: string,
  buildingName: string,
  pollTitle: string,
  pollReason: string,
  endFormatted: string,
  magicLink: string
): string {
  return `
    <div style="font-family: sans-serif; color: #1B2330; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #E5DFD3; border-radius: 12px; background: #F4F1EA;">
      <h2 style="font-family: Georgia, serif; color: #1F3A5F; margin-top: 0;">Pozvánka na elektronické hlasovanie</h2>
      <p>Vážený vlastník <strong>${ownerName}</strong>,</p>
      <p>v bytovom dome <strong>${buildingName}</strong> bolo vyhlásené elektronické hlasovanie:</p>
      
      <div style="background: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #E5DFD3; margin: 15px 0;">
        <h3 style="margin-top: 0; color: #1F3A5F;">${pollTitle}</h3>
        <p style="margin-bottom: 0; color: #5C6473; font-size: 14px;"><strong>Dôvod:</strong> ${pollReason}</p>
        <p style="margin-bottom: 0; color: #5C6473; font-size: 14px;"><strong>Termín na hlasovanie:</strong> do ${endFormatted}</p>
      </div>

      <p>Pre hlasovanie použite Váš osobný bezpečnostný odkaz (magic link) nižšie. Nikomu tento odkaz neposielajte, slúži ako Vaša jednoznačná identifikácia:</p>
      
      <div style="text-align: center; margin: 25px 0;">
        <a href="${magicLink}" style="background-color: #1F3A5F; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">👉 HLASOVAŤ ELEKTRONICKY</a>
      </div>

      <p style="font-size: 12px; color: #606673; line-height: 1.4;">
        Poznámka: Za byt sa počíta jeden hlas (v prípade spoluvlastníctva podľa nahláseného režimu). Hlasovanie prebieha v zmysle zákona č. 182/1993 Z. z. Svoj hlas môžete do skončenia hlasovania kedykoľvek zmeniť kliknutím na tento odkaz — započíta sa posledné odoslané hlasovanie.
      </p>
    </div>
  `;
}

export function getConfirmationEmailHtml(
  ownerName: string,
  unitNo: string,
  pollTitle: string,
  dateFormatted: string,
  answersSummary: { qNo: number; qTitle: string; answerText: string }[]
): string {
  const answersListHtml = answersSummary
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

  return `
    <div style="font-family: sans-serif; color: #1B2330; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #E5DFD3; border-radius: 12px; background: #F4F1EA;">
      <h2 style="font-family: Georgia, serif; color: #2E7D5B; margin-top: 0;">Potvrdenie o hlasovaní</h2>
      <p>Vážený vlastník <strong>${ownerName}</strong>,</p>
      <p>potvrdzujeme prijatie Vášho hlasu za byt/NP <strong>č. ${unitNo}</strong> v hlasovaní:</p>

      <div style="background: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #E5DFD3; margin: 15px 0;">
        <h3 style="margin-top: 0; color: #1F3A5F; font-size: 16px;">${pollTitle}</h3>
        <p style="color: #606673; font-size: 13px; margin-bottom: 12px;">Prijaté dňa: ${dateFormatted}</p>
        <ul style="padding-left: 20px; margin: 0;">
          ${answersListHtml}
        </ul>
      </div>

      <p>Váš hlas bol bezpečne zaznamenaný a zašifrovaný v auditnom logu. Do uzávierky môžete svoje rozhodnutie zmeniť opätovným otvorením Vášho magic-linku v pôvodnom e-maile.</p>
    </div>
  `;
}

export async function getInvitationEmail(params: {
  ownerName: string;
  buildingName: string;
  pollTitle: string;
  pollReason: string;
  endFormatted: string;
  magicLink: string;
}) {
  let template = await db.emailTemplate.findUnique({
    where: { key: "invitation" }
  });

  let subject = "Pozvánka na hlasovanie: {pollTitle}";
  let body = `
    <div style="font-family: sans-serif; color: #1B2330; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #E5DFD3; border-radius: 12px; background: #F4F1EA;">
      <h2 style="font-family: Georgia, serif; color: #1F3A5F; margin-top: 0;">Pozvánka na elektronické hlasovanie</h2>
      <p>Vážený vlastník <strong>{ownerName}</strong>,</p>
      <p>v bytovom dome <strong>{buildingName}</strong> bolo vyhlásené elektronické hlasovanie:</p>
      
      <div style="background: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #E5DFD3; margin: 15px 0;">
        <h3 style="margin-top: 0; color: #1F3A5F;">{pollTitle}</h3>
        <p style="margin-bottom: 0; color: #5C6473; font-size: 14px;"><strong>Dôvod:</strong> {pollReason}</p>
        <p style="margin-bottom: 0; color: #5C6473; font-size: 14px;"><strong>Termín na hlasovanie:</strong> do {endFormatted}</p>
      </div>

      <p>Pre hlasovanie použite Váš osobný bezpečnostný odkaz (magic link) nižšie. Nikomu tento odkaz neposielajte, slúži ako Vaša jednoznačná identifikácia:</p>
      
      <div style="text-align: center; margin: 25px 0;">
        <a href="{magicLink}" style="background-color: #1F3A5F; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">👉 HLASOVAŤ ELEKTRONICKY</a>
      </div>

      <p style="font-size: 12px; color: #606673; line-height: 1.4;">
        Poznámka: Za byt sa počíta jeden hlas (v prípade spoluvlastníctva podľa nahláseného režimu). Hlasovanie prebieha v zmysle zákona č. 182/1993 Z. z. Svoj hlas môžete do skončenia hlasovania kedykoľvek zmeniť kliknutím na tento odkaz — započíta sa posledné odoslané hlasovanie.
      </p>
    </div>
  `;

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
    html: replaceAll(body)
  };
}

export async function getProtocolEmail(params: {
  ownerName: string;
  buildingName: string;
  pollTitle: string;
  protocolLink: string;
}) {
  let template = await db.emailTemplate.findUnique({
    where: { key: "protocol" }
  });

  let subject = "Výsledok hlasovania: {pollTitle}";
  let body = `
    <div style="font-family: sans-serif; color: #1B2330; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #E5DFD3; border-radius: 12px; background: #F4F1EA;">
      <h2 style="font-family: Georgia, serif; color: #1F3A5F; margin-top: 0;">Výsledok hlasovania</h2>
      <p>Vážený vlastník <strong>{ownerName}</strong>,</p>
      <p>oznamujeme Vám, že elektronické hlasovanie bolo ukončené a výsledky boli oficiálne zapečatené:</p>
      
      <div style="background: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #E5DFD3; margin: 15px 0;">
        <h3 style="margin-top: 0; color: #1F3A5F; font-size: 16px;">{pollTitle}</h3>
        <p style="color: #606673; font-size: 13px; margin-bottom: 12px;"><strong>Stav:</strong> Uzavreté a overené</p>
        <p style="margin: 0; color: #606673; font-size: 13px;"><strong>Zápisnica (PDF):</strong> Na stiahnutie kliknutím na odkaz nižšie</p>
      </div>

      <p>Kompletnú zápisnicu o priebehu a výsledkoch si môžete stiahnuť aj priamo kliknutím na odkaz nižšie (odkaz nevyžaduje prihlásenie):</p>
      
      <div style="text-align: center; margin: 25px 0;">
        <a href="{protocolLink}" style="background-color: #1F3A5F; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Stiahnuť zápisnicu (PDF)</a>
      </div>
    </div>
  `;

  if (template) {
    subject = template.subject;
    body = template.body;
  }

  const replaceAll = (str: string) => {
    return str
      .replace(/{ownerName}/g, params.ownerName)
      .replace(/{buildingName}/g, params.buildingName)
      .replace(/{pollTitle}/g, params.pollTitle)
      .replace(/{protocolLink}/g, params.protocolLink);
  };

  return {
    subject: replaceAll(subject),
    html: replaceAll(body)
  };
}

export async function getCredentialsEmail(params: {
  ownerName: string;
  buildingName: string;
  buildingShort: string;
  loginLink: string;
  loginEmail: string;
  rawPassword: string;
}) {
  let template = await db.emailTemplate.findUnique({
    where: { key: "credentials" }
  });

  let subject = "Prihlasovacie údaje: Bytový dom {buildingShort}";
  let body = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; color: #1e293b;">
      <h2 style="font-size: 18px; font-weight: 600; color: #1e3a8a; margin-top: 0; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">
        Prihlasovacie údaje k hlasovaciemu systému
      </h2>
      <p style="font-size: 14px; line-height: 1.5; color: #334155; margin-top: 16px;">
        Dobrý deň, <strong>{ownerName}</strong>,<br>
        administrátor bytového domu <strong>{buildingName}</strong> Vám vygeneroval prístup do klientskej zóny hlasovacieho systému, kde si môžete kedykoľvek prečítať a stiahnuť výsledky hlasovaní.
      </p>
      <div style="background: #f8fafc; padding: 18px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0; font-size: 14px;">
        <p style="margin: 0 0 10px;"><strong>Prihlasovacia stránka:</strong> <a href="{loginLink}" style="color: #3b82f6; text-decoration: underline;">{loginLink}</a></p>
        <p style="margin: 0 0 10px;"><strong>Prihlasovací e-mail:</strong> {loginEmail}</p>
        <p style="margin: 0;"><strong>Prihlasovacie heslo:</strong> <code style="font-family: monospace; font-size: 15px; color: #b91c1c; font-weight: bold; background: #fee2e2; padding: 2px 6px; border-radius: 4px;">{rawPassword}</code></p>
      </div>
      <p style="font-size: 13px; color: #b91c1c; font-weight: 600; line-height: 1.5; background: #fffbeb; border: 1px solid #fef3c7; padding: 10px 12px; border-radius: 6px; margin: 18px 0;">
        ⚠️ Dôležité upozornenie: Pri prvom prihlásení Vás systém vyzve na zmenu tohto automaticky vygenerovaného hesla za Vaše vlastné bezpečné heslo.
      </p>
      <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 0;">
        Tento e-mail bol odoslaný automaticky. Neodpovedajte naň.
      </p>
    </div>
  `;

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
    html: replaceAll(body)
  };
}
