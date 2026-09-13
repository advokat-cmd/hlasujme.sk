import { NextResponse } from "next/server";
import { getAdminSession, revokeAdminSessions } from "@/lib/session";
import { db } from "@/lib/db";
import { createAuditLogEntry } from "@/lib/hashChain";
import * as argon2 from "argon2";
import { validatePasswordChangeInput } from "@/lib/security/input";

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Neprihlásený používateľ." }, { status: 401 });
    }

    let credentials: ReturnType<typeof validatePasswordChangeInput>;
    try {
      credentials = validatePasswordChangeInput(await request.json());
    } catch (error) {
      return NextResponse.json({ error: error instanceof SyntaxError ? "Neplatné údaje zmeny hesla." : error instanceof Error ? error.message : "Neplatné údaje zmeny hesla." }, { status: 400 });
    }
    const { oldPassword, newPassword } = credentials;

    const admin = await db.admin.findUnique({
      where: { id: session.adminId }
    });

    if (!admin) {
      return NextResponse.json({ error: "Používateľ nebol nájdený." }, { status: 404 });
    }

    // Overenie starého hesla
    const isOldPasswordValid = await argon2.verify(admin.passwordHash, oldPassword);
    if (!isOldPasswordValid) {
      return NextResponse.json({ error: "Zadané staré heslo je nesprávne." }, { status: 400 });
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id
    });

    await db.admin.update({
      where: { id: session.adminId },
      data: { passwordHash }
    });
    await revokeAdminSessions(session.adminId);

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
