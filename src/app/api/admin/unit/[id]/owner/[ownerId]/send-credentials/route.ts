import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { createAuditLogEntry } from "@/lib/hashChain";
import { sendEmail } from "@/lib/email";
import * as argon2 from "argon2";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; ownerId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session || session.role === "vlastnik") {
      return NextResponse.json({ error: "Nedostatočné oprávnenia." }, { status: 403 });
    }

    const { id: unitId, ownerId } = await params;

    const unit = await db.unit.findUnique({
      where: { id: unitId },
      include: { building: true }
    });

    const owner = await db.owner.findUnique({
      where: { id: ownerId }
    });

    if (!unit || !owner) {
      return NextResponse.json({ error: "Jednotka alebo vlastník nebol nájdený." }, { status: 404 });
    }

    if (!owner.email) {
      return NextResponse.json({ error: "Vlastník nemá zadanú e-mailovú adresu." }, { status: 400 });
    }

    const loginEmail = owner.email.trim().toLowerCase();

    // 1. Generate random password
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const rawPassword = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

    // 2. Hash password
    const passwordHash = await argon2.hash(rawPassword, {
      type: argon2.argon2id
    });

    // 3. Upsert admin record with role 'vlastnik'
    const dbAdmin = await db.admin.upsert({
      where: { email: loginEmail },
      update: {
        name: owner.name,
        passwordHash,
        role: "vlastnik",
        unitId: unit.id,
        ownerId: owner.id
      },
      create: {
        email: loginEmail,
        name: owner.name,
        passwordHash,
        role: "vlastnik",
        unitId: unit.id,
        ownerId: owner.id
      }
    });

    // 4. Send Email using sendEmail
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const loginLink = `${baseUrl}/admin/login`;

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; color: #1e293b;">
        <h2 style="font-size: 18px; font-weight: 600; color: #1e3a8a; margin-top: 0; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">
          Prihlasovacie údaje k hlasovaciemu systému
        </h2>
        <p style="font-size: 14px; line-height: 1.5; color: #334155; margin-top: 16px;">
          Dobrý deň, <strong>${owner.name}</strong>,<br>
          administrátor bytového domu <strong>${unit.building.name}</strong> Vám vygeneroval prístup do klientskej zóny hlasovacieho systému, kde si môžete kedykoľvek prečítať a stiahnuť výsledky hlasovaní.
        </p>
        <div style="background: #f8fafc; padding: 18px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0; font-size: 14px;">
          <p style="margin: 0 0 10px;"><strong>Prihlasovacia stránka:</strong> <a href="${loginLink}" style="color: #3b82f6; text-decoration: underline;">${loginLink}</a></p>
          <p style="margin: 0 0 10px;"><strong>Prihlasovací e-mail:</strong> ${loginEmail}</p>
          <p style="margin: 0;"><strong>Prihlasovacie heslo:</strong> <code style="font-family: monospace; font-size: 15px; color: #b91c1c; font-weight: bold; background: #fee2e2; padding: 2px 6px; border-radius: 4px;">${rawPassword}</code></p>
        </div>
        <p style="font-size: 13px; color: #b91c1c; font-weight: 600; line-height: 1.5; background: #fffbeb; border: 1px solid #fef3c7; padding: 10px 12px; border-radius: 6px; margin: 18px 0;">
          ⚠️ Dôležité upozornenie: Pri prvom prihlásení Vás systém vyzve na zmenu tohto automaticky vygenerovaného hesla za Vaše vlastné bezpečné heslo.
        </p>
        <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 0;">
          Tento e-mail bol odoslaný automaticky. Neodpovedajte naň.
        </p>
      </div>
    `;

    await sendEmail({
      to: loginEmail,
      subject: `Prihlasovacie údaje: Bytový dom ${unit.building.short}`,
      html: emailHtml
    });

    await createAuditLogEntry("CREDENTIALS_SENT", `admin:${session.email}`, {
      message: `Boli vygenerované a odoslané prihlasovacie údaje pre vlastníka ${owner.name} (${loginEmail}) bytu č. ${unit.no}.`,
      unitNo: unit.no,
      ownerName: owner.name,
      email: loginEmail
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Send credentials error:", err);
    return NextResponse.json({ error: "Interná chyba pri generovaní prístupu." }, { status: 500 });
  }
}
