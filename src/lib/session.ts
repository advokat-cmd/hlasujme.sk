import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "hlasovanie_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "default-fallback-secret-that-must-be-changed-in-prod";

// Helper to sign/verify tokens using standard Web Crypto API (HMAC SHA-256)
async function getCryptoKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyData = enc.encode(SESSION_SECRET);
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
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7 // 7 days
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
