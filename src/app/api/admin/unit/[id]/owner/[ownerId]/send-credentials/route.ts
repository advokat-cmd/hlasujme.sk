import { NextResponse } from "next/server";
import { getAdminSession, revokeAdminSessions } from "@/lib/session";
import { db } from "@/lib/db";
import { createAuditLogEntry } from "@/lib/hashChain";
import { sendEmail, getCredentialsEmail } from "@/lib/email";
import * as argon2 from "argon2";
import { generateTemporaryPassword } from "@/lib/security/passwords";
import { assertAccountMutationAllowed, assertOwnerBelongsToUnit } from "@/lib/security/accounts";

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

    try {
      assertOwnerBelongsToUnit(owner, unitId);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Vlastník nepatrí do jednotky." }, { status: 400 });
    }

    if (!owner.email) {
      return NextResponse.json({ error: "Vlastník nemá zadanú e-mailovú adresu." }, { status: 400 });
    }

    const loginEmail = owner.email.trim().toLowerCase();

    // 1. Generate random password
    const rawPassword = generateTemporaryPassword();

    // 2. Hash password
    const passwordHash = await argon2.hash(rawPassword, {
      type: argon2.argon2id
    });

    // 3. Upsert admin record with role 'vlastnik'
    const [ownerAccount, emailAccount] = await Promise.all([
      db.admin.findFirst({ where: { ownerId: owner.id } }),
      db.admin.findUnique({ where: { email: loginEmail } }),
    ]);
    if (emailAccount && emailAccount.ownerId !== owner.id) {
      return NextResponse.json({ error: "E-mail už používa iný účet." }, { status: 409 });
    }
    const existingAccount = ownerAccount ?? emailAccount;
    try {
      assertAccountMutationAllowed(session, existingAccount, "vlastnik");
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Nedostatočné oprávnenia." }, { status: 403 });
    }

    const accountData = {
        name: owner.name,
        passwordHash,
        role: "vlastnik",
        unitId: unit.id,
        ownerId: owner.id
    };
    const dbAdmin = existingAccount
      ? await db.admin.update({ where: { id: existingAccount.id }, data: { ...accountData, email: loginEmail } })
      : await db.admin.create({ data: {
        email: loginEmail,
        ...accountData,
      } });
    await revokeAdminSessions(dbAdmin.id);

    // 4. Send Email using sendEmail
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const loginLink = `${baseUrl}/admin/login`;

    const emailContent = await getCredentialsEmail({
      ownerName: owner.name,
      buildingName: unit.building.name,
      buildingShort: unit.building.short || unit.building.address.split(",")[0],
      loginLink,
      loginEmail,
      rawPassword
    });

    await sendEmail({
      to: loginEmail,
      subject: emailContent.subject,
      html: emailContent.html
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
