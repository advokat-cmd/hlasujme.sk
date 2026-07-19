import { createHash, timingSafeEqual } from "node:crypto";

function normalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item === undefined) throw new Error("Hodnotu nemožno kanonicky serializovať.");
      output[key] = normalize(item);
    }
    return output;
  }
  throw new Error("Hodnotu nemožno kanonicky serializovať.");
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export function verifySha256(data: string | Uint8Array, expected: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expected)) return false;
  const actualBuffer = Buffer.from(sha256Hex(data), "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return timingSafeEqual(actualBuffer, expectedBuffer);
}
