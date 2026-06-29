import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { createAuditLogEntry } from "@/lib/hashChain";
import { sendEmail, getCredentialsEmail } from "@/lib/email";
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
