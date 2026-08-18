import { PollStatus, Prisma } from "@prisma/client";
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
  const [closedPolls, otherPolls, owners, ownerAccounts, protectedOwnerAccounts] = await Promise.all([
    client.poll.count({ where: { status: PollStatus.closed } }),
    client.poll.count({ where: { status: { not: PollStatus.closed } } }),
    client.owner.count(),
    client.admin.count({ where: { ownerId: { not: null }, role: "vlastnik" } }),
    client.admin.count({ where: { ownerId: { not: null }, role: { not: "vlastnik" } } }),
  ]);
  return { closedPolls, otherPolls, owners, ownerAccounts, protectedOwnerAccounts };
}

function assertExpectedTargets(summary: Awaited<ReturnType<typeof summarize>>) {
  if (summary.owners !== 2) throw new Error(`Očakávali sa presne 2 vlastníci, nájdených je ${summary.owners}.`);
}

async function main() {
  const before = await summarize(db);
  console.log(JSON.stringify({ phase: "before", apply, ...before }));
  if (!apply) return;

  if (process.env.CONFIRM_TEST_DATA_PURGE !== "DELETE_CLOSED_POLLS_AND_TWO_OWNERS") {
    throw new Error("Chýba presné potvrdenie produkčného mazania.");
  }

  const deleted = await db.$transaction(async tx => {
    const current = await summarize(tx);
    assertExpectedTargets(current);

    // Delete only ordinary owner login accounts. Privileged accounts are preserved;
    // the Owner foreign key uses ON DELETE SET NULL and is safely detached below.
    const ownerAccounts = await tx.admin.deleteMany({
      where: { ownerId: { not: null }, role: "vlastnik" },
    });
    const polls = await tx.poll.deleteMany({ where: { status: PollStatus.closed } });
    const owners = await tx.owner.deleteMany();
    return { closedPolls: polls.count, owners: owners.count, ownerAccounts: ownerAccounts.count };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const after = await summarize(db);
  if (after.closedPolls !== 0 || after.owners !== 0 || after.ownerAccounts !== 0) {
    throw new Error("Kontrola po mazaní zlyhala.");
  }
  if (after.otherPolls !== before.otherPolls) throw new Error("Počet nearchívnych hlasovaní sa zmenil.");
  console.log(JSON.stringify({ phase: "deleted", ...deleted }));
  console.log(JSON.stringify({ phase: "after", ...after }));
}

main().finally(() => db.$disconnect());
