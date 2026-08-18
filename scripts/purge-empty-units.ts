import { Prisma } from "@prisma/client";
import { db } from "../src/lib/db";

const args = process.argv.slice(2);
if (args.some(arg => arg !== "--apply")) throw new Error("Povolený je iba prepínač --apply.");
const apply = args.includes("--apply");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL je povinné.");
const parsedDatabaseUrl = new URL(databaseUrl);
if (parsedDatabaseUrl.pathname.replace(/^\//, "") !== "lemon" || parsedDatabaseUrl.searchParams.get("schema") !== "hlasujme") {
  throw new Error("Operácia je povolená iba pre databázu lemon a schému hlasujme.");
}

type Client = Prisma.TransactionClient | typeof db;

async function summarize(client: Client) {
  const [units, owners, polls, adminCount, unitLinkedAccounts] = await Promise.all([
    client.unit.count(),
    client.owner.count(),
    client.poll.count(),
    client.admin.count(),
    client.admin.count({ where: { unitId: { not: null } } }),
  ]);
  return { units, owners, polls, adminCount, unitLinkedAccounts };
}

function assertSafeTarget(summary: Awaited<ReturnType<typeof summarize>>) {
  if (summary.owners !== 0) throw new Error("Mazanie bytov je povolené až po vymazaní vlastníkov.");
  if (summary.polls !== 0) throw new Error("Mazanie bytov je zablokované, kým existuje hlasovanie.");
  const expectedUnits = Number(process.env.EXPECTED_UNIT_COUNT);
  if (!Number.isSafeInteger(expectedUnits) || expectedUnits < 1 || summary.units !== expectedUnits) {
    throw new Error(`Počet bytov sa nezhoduje s potvrdením: očakávané ${process.env.EXPECTED_UNIT_COUNT}, nájdené ${summary.units}.`);
  }
}

async function main() {
  const before = await summarize(db);
  console.log(JSON.stringify({ phase: "before", apply, ...before }));
  if (!apply) return;

  if (process.env.CONFIRM_UNIT_PURGE !== "DELETE_ALL_CURRENT_UNITS") {
    throw new Error("Chýba presné potvrdenie produkčného mazania bytov.");
  }

  const deleted = await db.$transaction(async tx => {
    const current = await summarize(tx);
    assertSafeTarget(current);
    return tx.unit.deleteMany();
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const after = await summarize(db);
  if (after.units !== 0 || after.owners !== 0 || after.polls !== 0) throw new Error("Kontrola po vymazaní bytov zlyhala.");
  if (after.adminCount !== before.adminCount) throw new Error("Počet administrátorských účtov sa zmenil.");
  console.log(JSON.stringify({ phase: "deleted", units: deleted.count }));
  console.log(JSON.stringify({ phase: "after", ...after }));
}

main().finally(() => db.$disconnect());
