import { Prisma } from "@prisma/client";
import { db } from "../src/lib/db";
import { synchronizeSingleOwnerEmail } from "../src/lib/unitEmails";

const args = process.argv.slice(2);
if (args.some(arg => arg !== "--apply")) throw new Error("Povolený je iba prepínač --apply.");
const apply = args.includes("--apply");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL je povinné.");
const parsedDatabaseUrl = new URL(databaseUrl);
if (parsedDatabaseUrl.pathname.replace(/^\//, "") !== "lemon" || parsedDatabaseUrl.searchParams.get("schema") !== "hlasujme") {
  throw new Error("Synchronizácia je povolená iba pre databázu lemon a schému hlasujme.");
}

async function inspect(client: Prisma.TransactionClient | typeof db = db) {
  const [units, admins] = await Promise.all([client.unit.findMany({
    where: { coMode: "single" },
    include: { owners: { include: { admins: true } } },
  }), client.admin.findMany({ select: { email: true, ownerId: true } })]);
  const repairs: Array<{ unitId: string; ownerId: string; email: string }> = [];
  let ambiguousCount = 0;

  for (const unit of units) {
    if (unit.owners.length !== 1) {
      ambiguousCount += 1;
      continue;
    }
    const owner = unit.owners[0];
    let synchronized;
    try {
      synchronized = synchronizeSingleOwnerEmail(unit.coMode, unit.email || "", [owner]);
    } catch {
      ambiguousCount += 1;
      continue;
    }
    const email = synchronized.unitEmail;
    const linkedAdmin = owner.admins[0];
    const emailAdmin = email ? admins.find(admin => admin.email.toLowerCase() === email) : null;
    if (
      owner.admins.length > 1
      || linkedAdmin && linkedAdmin.email.toLowerCase() !== email
      || emailAdmin && emailAdmin.ownerId !== owner.id
    ) {
      ambiguousCount += 1;
      continue;
    }
    if ((unit.email || "") !== email || (owner.email || "") !== email) {
      repairs.push({ unitId: unit.id, ownerId: owner.id, email });
    }
  }

  return { repairs, ambiguousCount, adminCount: admins.length };
}

async function main() {
  const before = await inspect();
  console.log(JSON.stringify({
    phase: "inspected",
    apply,
    repairCount: before.repairs.length,
    ambiguousCount: before.ambiguousCount,
  }));
  if (before.ambiguousCount !== 0) throw new Error("Register obsahuje nejednoznačné e-mailové záznamy.");
  if (!apply) return;
  if (process.env.CONFIRM_SINGLE_OWNER_EMAIL_SYNC !== "SYNC_SINGLE_OWNER_EMAILS") {
    throw new Error("Chýba presné potvrdenie produkčnej synchronizácie.");
  }

  await db.$transaction(async tx => {
    const current = await inspect(tx);
    if (current.ambiguousCount !== 0) throw new Error("Register sa pred zápisom zmenil alebo obsahuje nejednoznačné e-maily.");
    if (current.adminCount !== before.adminCount) throw new Error("Počet administrátorských účtov sa pred zápisom zmenil.");
    for (const repair of current.repairs) {
      await tx.unit.update({ where: { id: repair.unitId }, data: { email: repair.email || null } });
      await tx.owner.update({ where: { id: repair.ownerId }, data: { email: repair.email || null } });
    }
    const verified = await inspect(tx);
    if (verified.repairs.length !== 0 || verified.ambiguousCount !== 0) {
      throw new Error("Synchronizácia e-mailov neprešla kontrolou v transakcii.");
    }
    if (verified.adminCount !== before.adminCount) throw new Error("Počet administrátorských účtov sa zmenil.");
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const after = await inspect();
  if (after.repairs.length !== 0 || after.ambiguousCount !== 0) {
    throw new Error("Synchronizácia e-mailov neprešla záverečnou kontrolou.");
  }
  if (after.adminCount !== before.adminCount) throw new Error("Počet administrátorských účtov sa zmenil.");
  console.log(JSON.stringify({ phase: "verified", repairedCount: before.repairs.length }));
}

main().finally(() => db.$disconnect());
