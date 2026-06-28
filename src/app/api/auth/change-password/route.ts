import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { createAuditLogEntry } from "@/lib/hashChain";
import * as argon2 from "argon2";

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Neprihlásený používateľ." }, { status: 401 });
    }

    const { newPassword } = await request.json();
    if (!newPassword || newPassword.trim().length < 6) {
      return NextResponse.json({ error: "Heslo musí mať aspoň 6 znakov." }, { status: 400 });
    }

    const admin = await db.admin.findUnique({
      where: { id: session.adminId }
    });

    if (!admin) {
      return NextResponse.json({ error: "Používateľ nebol nájdený." }, { status: 404 });
    }

    const passwordHash = await argon2.hash(newPassword.trim(), {
      type: argon2.argon2id
    });

    await db.admin.update({
      where: { id: session.adminId },
      data: { passwordHash }
    });

    await createAuditLogEntry("PASSWORD_CHANGED", `user:${session.email}`, {
      message: `Používateľ ${session.name} (${session.email}) si zmenil prihlasovacie heslo.`,
      email: session.email,
      name: session.name
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Change password error:", err);
    return NextResponse.json({ error: "Interná chyba na serveri." }, { status: 500 });
  }
}
