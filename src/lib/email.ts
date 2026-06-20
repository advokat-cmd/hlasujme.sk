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
