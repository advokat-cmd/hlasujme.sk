import path from "node:path";

const ALLOWED = new Map<string, Set<string>>([
  ["application/pdf", new Set([".pdf"])],
  ["image/png", new Set([".png"])],
  ["image/jpeg", new Set([".jpg", ".jpeg"])],
  ["text/plain", new Set([".txt"])],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", new Set([".docx"])],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", new Set([".xlsx"])],
]);

export function isAllowedDocument(mimeType: string, fileName: string): boolean {
  const extensions = ALLOWED.get(mimeType.toLowerCase());
  return !!extensions?.has(path.extname(fileName).toLowerCase());
}

export function hasValidDocumentSignature(mimeType: string, bytes: Uint8Array): boolean {
  if (mimeType === "text/plain") return true;
  if (mimeType === "application/pdf") return bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-";
  if (mimeType === "image/png") return bytes.length >= 8 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType.includes("officedocument")) return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  return false;
}
