import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "hlasovanie_session";

/**
 * Returns the HMAC secret for session cookies and signed download links.
 * In production a missing/weak SESSION_SECRET is a fatal misconfiguration —
 * a known fallback secret would let anyone forge an admin session.
 */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) {
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET musí byť nastavený (min. 16 znakov) — bez neho sa dajú sfalšovať admin session cookies.");
  }
  console.warn("SESSION_SECRET nie je nastavený — používa sa nechránený DEV fallback.");
  return "dev-only-insecure-secret";
}

// Helper to sign/verify tokens using standard Web Crypto API (HMAC SHA-256)
async function getCryptoKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyData = enc.encode(getSessionSecret());
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign", "verify"]
  );
}

export async function encryptSession(payload: any): Promise<string> {
  const enc = new TextEncoder();
  const payloadStr = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadStr).toString("base64url");
  
  const key = await getCryptoKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(payloadBase64)
  );
  
  const signatureBase64 = Buffer.from(signature).toString("base64url");
  return `${payloadBase64}.${signatureBase64}`;
}

export async function decryptSession(token: string): Promise<any | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadBase64, signatureBase64] = parts;
  
  try {
    const key = await getCryptoKey();
    const enc = new TextEncoder();
    const data = enc.encode(payloadBase64);
    const signature = Buffer.from(signatureBase64, "base64url");

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      data
    );

    if (!isValid) return null;

    const decodedStr = Buffer.from(payloadBase64, "base64url").toString("utf-8");
    return JSON.parse(decodedStr);
  } catch (err) {
    return null;
  }
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
  const cookieVal = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!cookieVal) return null;
  return decryptSession(cookieVal);
}

export async function setAdminSession(session: AdminSession): Promise<void> {
  const token = await encryptSession(session);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    // Secure by default — only plain-HTTP local dev opts out
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7 // 7 days
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
