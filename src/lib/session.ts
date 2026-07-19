import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";

const SESSION_COOKIE_NAME = "hlasovanie_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET musí mať v produkcii aspoň 32 znakov.");
  }
  return "dev-only-insecure-secret-change-me";
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface AdminSession {
  adminId: string;
  email: string;
  name: string;
  unitId: string | null;
  role: string;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const now = new Date();
  const session = await db.adminSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { admin: true },
  });
  if (!session || session.revokedAt || session.expiresAt <= now) {
    if (session && !session.revokedAt) {
      await db.adminSession.update({ where: { id: session.id }, data: { revokedAt: now } });
    }
    return null;
  }
  return {
    adminId: session.admin.id,
    email: session.admin.email,
    name: session.admin.name,
    unitId: session.admin.unitId,
    role: session.admin.role,
  };
}

export async function setAdminSession(session: AdminSession): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await db.adminSession.create({
    data: {
      tokenHash: hashSessionToken(token),
      adminId: session.adminId,
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
    },
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function revokeAdminSessions(adminId: string): Promise<void> {
  await db.adminSession.updateMany({
    where: { adminId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await db.adminSession.updateMany({
      where: { tokenHash: hashSessionToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}
