import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setAdminSession } from "@/lib/session";
import { checkRateLimit } from "@/lib/rateLimit";
import { createAuditLogEntry } from "@/lib/hashChain";
import * as argon2 from "argon2";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
    
    // Limit login attempts to 5 per minute
    if (!checkRateLimit(ip, 5, 60000)) {
      return NextResponse.json(
        { error: "Príliš veľa pokusov o prihlásenie. Skúste to znova o minútu." },
        { status: 429 }
      );
    }

    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: "E-mail a heslo sú povinné." }, { status: 400 });
    }

    const admin = await db.admin.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!admin) {
      return NextResponse.json({ error: "Nesprávny e-mail alebo heslo." }, { status: 401 });
    }

    const isValid = await argon2.verify(admin.passwordHash, password);
    if (!isValid) {
      return NextResponse.json({ error: "Nesprávny e-mail alebo heslo." }, { status: 401 });
    }

    // Auto-promote the configured bootstrap superadmin (SUPERADMIN_EMAIL env)
    const superadminEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
    let finalRole = admin.role;
    if (superadminEmail && admin.email.trim().toLowerCase() === superadminEmail && admin.role !== "superadmin") {
      await db.admin.update({
        where: { id: admin.id },
        data: { role: "superadmin" }
      });
      finalRole = "superadmin";
    }

    await setAdminSession({
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
      unitId: admin.unitId,
      role: finalRole
    });

    await createAuditLogEntry("USER_LOGIN", `user:${admin.email}`, {
      message: `Používateľ ${admin.name} (${admin.email}) sa prihlásil s rolou ${finalRole}.`,
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
      role: finalRole,
      ip
    });

    return NextResponse.json({
      success: true,
      user: { name: admin.name, email: admin.email, unitId: admin.unitId, role: finalRole }
    });
  } catch (err) {
    console.error("Login API error:", err);
    return NextResponse.json({ error: "Vyskytla sa interná chyba na serveri." }, { status: 500 });
  }
}
