import path from "node:path";
import { db } from "../src/lib/db";
import { getStorageRoot } from "../src/lib/storage";
import { planLegacyRelocation, relocateLegacyFile } from "../src/lib/legacyStorage";

const args = process.argv.slice(2);
if (args.some(arg => arg !== "--dry-run")) throw new Error("Povolený je iba prepínač --dry-run.");
const dryRun = args.includes("--dry-run");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL je povinné.");
const parsedDatabaseUrl = new URL(databaseUrl);
if (parsedDatabaseUrl.pathname.replace(/^\//, "") !== "lemon" || parsedDatabaseUrl.searchParams.get("schema") !== "hlasujme") {
  throw new Error("Migrácia je povolená iba pre databázu lemon a schému hlasujme.");
}
const legacyRoot = path.resolve(process.env.LEGACY_STORAGE_ROOT || path.join(process.cwd(), "storage"));
const storageRoot = getStorageRoot();

async function main() {
  const [documents, sealedResults] = await Promise.all([
    db.pollDocument.findMany({ where: { localPath: { not: null } }, select: { id: true, localPath: true } }),
    db.sealedResult.findMany({ select: { id: true, pdfPath: true } }),
  ]);
  const records = [
    ...documents.map(record => ({ type: "PollDocument" as const, id: record.id, storedPath: record.localPath! })),
    ...sealedResults.map(record => ({ type: "SealedResult" as const, id: record.id, storedPath: record.pdfPath })),
  ];

  let count = 0;
  for (const record of records) {
    const plan = planLegacyRelocation(record.storedPath, legacyRoot, storageRoot);
    if (!plan) continue;
    const result = relocateLegacyFile(plan, dryRun);
    if (!dryRun) {
      if (record.type === "PollDocument") {
        await db.pollDocument.update({ where: { id: record.id }, data: { localPath: plan.normalizedPath } });
      } else {
        await db.sealedResult.update({ where: { id: record.id }, data: { pdfPath: plan.normalizedPath } });
      }
    }
    count += 1;
    console.log(JSON.stringify({ ...record, normalizedPath: plan.normalizedPath, dryRun, copied: result.copied, sha256: result.sourceSha256 }));
  }
  console.log(`legacy_records=${count}`);
}

main().finally(() => db.$disconnect());
