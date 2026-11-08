import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setAdminSession } from "@/lib/session";
import { consumeRateLimit, privateRateLimitKey } from "@/lib/security/rateLimit";
import { getClientIp } from "@/lib/security/clientIp";
import { createAuditLogEntry } from "@/lib/hashChain";
import * as argon2 from "argon2";
import { validateLoginInput } from "@/lib/security/input";
import { isAccountRole } from "@/lib/security/accounts";

type LoginMode = "form" | "json";

function loginMode(request: Request): LoginMode {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")
    ? "form"
    : "json";
}

function loginError(request: Request, mode: LoginMode, error: string, status: number, code: "invalid" | "rate" | "server") {
  if (mode === "form") {
    const target = new URL("/", request.url);
    target.searchParams.set("error", code);
    return NextResponse.redirect(target, 303);
  }
  return NextResponse.json(
    { error },
    status === 429
      ? { status, headers: { "Retry-After": "60" } }
      : { status },
  );
}

async function readLoginInput(request: Request, mode: LoginMode): Promise<unknown> {
  if (mode === "json") return request.json();
  const form = await request.formData();
  return { email: form.get("email"), password: form.get("password") };
}

export async function POST(request: Request) {
  const mode = loginMode(request);
  try {
    const ip = getClientIp(request.headers);

    if (mode === "form" && request.headers.get("sec-fetch-site") === "cross-site") {
      return loginError(request, mode, "Neplatné prihlasovacie údaje.", 403, "invalid");
    }
    
    // Limit login attempts to 5 per minute
    const rateLimit = await consumeRateLimit({ action: "login", key: privateRateLimitKey(ip), limit: 5, windowMs: 60000 });
    if (!rateLimit.allowed) {
      if (mode === "form") {
        return loginError(request, mode, "Príliš veľa pokusov o prihlásenie. Skúste to znova o minútu.", 429, "rate");
      }
      return NextResponse.json(
        { error: "Príliš veľa pokusov o prihlásenie. Skúste to znova o minútu." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }

    let credentials: ReturnType<typeof validateLoginInput>;
    try {
      credentials = validateLoginInput(await readLoginInput(request, mode));
    } catch {
      return loginError(request, mode, "Neplatné prihlasovacie údaje.", 400, "invalid");
    }
    const { email, password } = credentials;

    const admin = await db.admin.findUnique({
      where: { email }
    });

    if (!admin) {
      return loginError(request, mode, "Nesprávny e-mail alebo heslo.", 401, "invalid");
    }

    const isValid = await argon2.verify(admin.passwordHash, password);
    if (!isValid) {
      return loginError(request, mode, "Nesprávny e-mail alebo heslo.", 401, "invalid");
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

    if (!isAccountRole(finalRole)) {
      return loginError(request, mode, "Nesprávny e-mail alebo heslo.", 403, "invalid");
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

    if (mode === "form") {
      return NextResponse.redirect(new URL("/admin", request.url), 303);
    }
    return NextResponse.json({
      success: true,
      user: { name: admin.name, email: admin.email, unitId: admin.unitId, role: finalRole },
    });
  } catch (err) {
    console.error("Login API error:", err);
    return loginError(request, mode, "Vyskytla sa interná chyba na serveri.", 500, "server");
  }
}
