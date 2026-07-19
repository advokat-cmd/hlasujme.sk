import { isIP } from "node:net";

function normalizeIp(value: string | null): string {
  if (!value) return "unknown";
  const candidate = value.trim().replace(/^\[|\]$/g, "");
  return isIP(candidate) ? candidate : "unknown";
}

export function getClientIp(headers: Headers, trustProxy = process.env.TRUST_PROXY === "1"): string {
  if (!trustProxy) return "unknown";
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const values = forwarded.split(",");
    return normalizeIp(values[values.length - 1] ?? null);
  }
  return normalizeIp(headers.get("x-real-ip"));
}
