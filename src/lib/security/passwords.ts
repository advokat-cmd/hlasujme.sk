import { randomBytes } from "node:crypto";

export function generateTemporaryPassword(bytes = 18): string {
  if (!Number.isInteger(bytes) || bytes < 15) throw new Error("Dočasné heslo musí mať dostatočnú entropiu.");
  return randomBytes(bytes).toString("base64url");
}
