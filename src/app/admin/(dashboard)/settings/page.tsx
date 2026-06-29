import React from "react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { SettingsView } from "@/components/admin/SettingsView";

export const revalidate = 0; // Disable server cache

export default async function AdminSettingsPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  if (session.role === "vlastnik") {
    redirect("/admin");
  }

  const templates = await db.questionTemplate.findMany({
    orderBy: { createdAt: "asc" }
  });

  // Fetch email templates
  let emailTemplates = await db.emailTemplate.findMany();
  
  if (!emailTemplates.some(t => t.key === "invitation")) {
    const defaultInvitation = await db.emailTemplate.create({
      data: {
        key: "invitation",
        subject: "Pozvánka na hlasovanie: {pollTitle}",
        body: `<div style="font-family: sans-serif; color: #1B2330; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #E5DFD3; border-radius: 12px; background: #F4F1EA;">
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
</div>`
      }
    });
    emailTemplates.push(defaultInvitation);
  }

  if (!emailTemplates.some(t => t.key === "protocol")) {
    const defaultProtocol = await db.emailTemplate.create({
      data: {
        key: "protocol",
        subject: "Výsledok hlasovania: {pollTitle}",
        body: `<div style="font-family: sans-serif; color: #1B2330; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #E5DFD3; border-radius: 12px; background: #F4F1EA;">
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
</div>`
      }
    });
    emailTemplates.push(defaultProtocol);
  }

  if (!emailTemplates.some(t => t.key === "credentials")) {
    const defaultCredentials = await db.emailTemplate.create({
      data: {
        key: "credentials",
        subject: "Prihlasovacie údaje: Bytový dom {buildingShort}",
        body: `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; color: #1e293b;">
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
</div>`
      }
    });
    emailTemplates.push(defaultCredentials);
  }

  // Map to clean client model
  const mappedTemplates = templates.map(t => ({
    id: t.id,
    title: t.title,
    text: t.text,
    majorityType: t.majorityType,
    note: t.note || ""
  }));

  const mappedEmailTemplates = emailTemplates.map(t => ({
    key: t.key,
    subject: t.subject,
    body: t.body
  }));

  return <SettingsView templates={mappedTemplates} emailTemplates={mappedEmailTemplates} />;
}
