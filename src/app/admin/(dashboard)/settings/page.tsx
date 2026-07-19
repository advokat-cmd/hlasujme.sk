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
  const emailTemplates = await db.emailTemplate.findMany();
  
  if (!emailTemplates.some(t => t.key === "invitation")) {
    const defaultInvitation = await db.emailTemplate.create({
      data: {
        key: "invitation",
        subject: "Pozvánka na hlasovanie: {pollTitle}",
        body: `<h2>Pozvánka na elektronické hlasovanie</h2>
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
</p>`
      }
    });
    emailTemplates.push(defaultInvitation);
  }

  if (!emailTemplates.some(t => t.key === "protocol")) {
    const defaultProtocol = await db.emailTemplate.create({
      data: {
        key: "protocol",
        subject: "Výsledok hlasovania: {pollTitle}",
        body: `<h2>Výsledok hlasovania</h2>
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
        body: `<h2>Prihlasovacie údaje k hlasovaciemu systému</h2>
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
</p>`
      }
    });
    emailTemplates.push(defaultCredentials);
  }

  if (!emailTemplates.some(t => t.key === "reminder")) {
    const defaultReminder = await db.emailTemplate.create({
      data: {
        key: "reminder",
        subject: "UPOZORNENIE: Pripomienka k hlasovaniu: {pollTitle}",
        body: `<h2>Pripomienka k elektronickému hlasovaniu</h2>
<p>Vážený vlastník <strong>{ownerName}</strong>,</p>
<p>pripomíname Vám prebiehajúce elektronické hlasovanie v dome <strong>{buildingName}</strong>, ktoré končí o 48 hodín:</p>

<div class="box">
  <h3>{pollTitle}</h3>
  <p class="meta"><strong>Koniec hlasovania:</strong> do {endFormatted}</p>
</div>

<p>Ak ste doteraz neodovzdali svoj hlas, môžete tak urobiť kliknutím na odkaz nižšie:</p>

<div style="text-align: center; margin: 25px 0;">
  <a class="btn" href="{magicLink}">👉 HLASOVAŤ ELEKTRONICKY</a>
</div>`
      }
    });
    emailTemplates.push(defaultReminder);
  }

  if (!emailTemplates.some(t => t.key === "confirmation")) {
    const defaultConfirmation = await db.emailTemplate.create({
      data: {
        key: "confirmation",
        subject: "Potvrdenie o hlasovaní: {pollTitle}",
        body: `<h2>Potvrdenie o hlasovaní</h2>
<p>Vážený vlastník <strong>{ownerName}</strong>,</p>
<p>potvrdzujeme prijatie Vášho hlasu za byt/NP <strong>č. {unitNo}</strong> v hlasovaní:</p>

<div class="box">
  <h3>{pollTitle}</h3>
  <p class="meta"><strong>Prijaté dňa:</strong> {dateFormatted}</p>
  <ul style="padding-left: 20px; margin: 0; font-size: 13.5px; line-height: 1.5; color: #5C6473;">
    {answersList}
  </ul>
</div>

<p>Váš hlas bol bezpečne zaznamenaný a zašifrovaný v auditnom logu. Do uzávierky môžete svoje rozhodnutie zmeniť opätovným otvorením Vášho magic-linku v pôvodnom e-maile.</p>`
      }
    });
    emailTemplates.push(defaultConfirmation);
  }

  // Map to clean client model
  const mappedTemplates = templates.map(t => ({
    id: t.id,
    title: t.title,
    text: t.text,
    majorityType: t.majorityType,
    note: t.note || ""
  }));

  const order = ["invitation", "reminder", "confirmation", "protocol", "credentials"];
  const sortedEmailTemplates = [...emailTemplates].sort((a, b) => {
    let idxA = order.indexOf(a.key);
    let idxB = order.indexOf(b.key);
    if (idxA === -1) idxA = 999;
    if (idxB === -1) idxB = 999;
    return idxA - idxB;
  });

  const mappedEmailTemplates = sortedEmailTemplates.map(t => ({
    key: t.key,
    subject: t.subject,
    body: t.body
  }));

  return <SettingsView templates={mappedTemplates} emailTemplates={mappedEmailTemplates} />;
}
