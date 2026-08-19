import { Prisma } from "@prisma/client";
import { db } from "../src/lib/db";
import { validateEmailAssignment } from "../src/lib/maintenance/emailAssignment";
import { matchesRegisterBuilding } from "../src/lib/maintenance/registerImport";

const args = process.argv.slice(2);
if (args.some(arg => arg !== "--apply" && arg !== "--verify") || args.includes("--apply") && args.includes("--verify")) {
  throw new Error("Povolený je práve jeden prepínač --apply alebo --verify.");
}
const apply = args.includes("--apply");
const verify = args.includes("--verify");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL je povinné.");
const parsedDatabaseUrl = new URL(databaseUrl);
if (parsedDatabaseUrl.pathname.replace(/^\//, "") !== "lemon" || parsedDatabaseUrl.searchParams.get("schema") !== "hlasujme") {
  throw new Error("Priradenie je povolené iba pre databázu lemon a schému hlasujme.");
}

const encodedPayload = process.env.EMAIL_ASSIGNMENT_PAYLOAD_B64;
if (!encodedPayload) throw new Error("Chýba importný payload.");
const imported = validateEmailAssignment(JSON.parse(Buffer.from(encodedPayload, "base64").toString("utf8")));
if (process.env.EXPECTED_EMAIL_FINGERPRINT && process.env.EXPECTED_EMAIL_FINGERPRINT !== imported.fingerprint) {
  throw new Error("Kontrolný odtlačok importu sa nezhoduje.");
}

async function currentRegistry() {
  const building = await db.building.findFirst({
    include: {
      units: {
        orderBy: { no: "asc" },
        include: { owners: { orderBy: [{ last: "asc" }, { first: "asc" }] } },
      },
    },
  });
  const [buildingCount, pollCount, adminCount] = await Promise.all([
    db.building.count(),
    db.poll.count(),
    db.admin.count(),
  ]);
  return { building, buildingCount, pollCount, adminCount };
}

function plannedUpdates(current: Awaited<ReturnType<typeof currentRegistry>>) {
  if (!current.building || current.buildingCount !== 1) throw new Error("Očakáva sa práve jeden bytový dom.");
  if (!matchesRegisterBuilding(imported.payload.buildingEntrance, current.building)) throw new Error("Import patrí inému vchodu.");

  const updates = imported.payload.assignments.map(assignment => {
    const unit = current.building!.units.find(candidate => candidate.no === assignment.unitNo);
    if (!unit) throw new Error(`Byt ${assignment.unitNo} sa v registri nenašiel.`);
    const owner = assignment.owner
      ? unit.owners.find(candidate => candidate.first === assignment.owner!.first && candidate.last === assignment.owner!.last)
      : null;
    if (assignment.owner && !owner) throw new Error(`Určený vlastník bytu ${assignment.unitNo} sa v registri nenašiel.`);
    if (unit.coMode === "internal" && !owner) throw new Error(`Interný byt ${assignment.unitNo} vyžaduje konkrétneho vlastníka.`);

    const writesUnit = unit.coMode !== "internal";
    if (writesUnit && unit.email && unit.email.toLowerCase() !== assignment.email) {
      throw new Error(`Byt ${assignment.unitNo} už má iný e-mail.`);
    }
    if (owner?.email && owner.email.toLowerCase() !== assignment.email) {
      throw new Error(`Určený vlastník bytu ${assignment.unitNo} už má iný e-mail.`);
    }
    return { assignment, unit, owner, writesUnit };
  });
  const unitTargets = new Set<string>();
  for (const update of updates) {
    if (!update.writesUnit) continue;
    if (unitTargets.has(update.unit.id)) throw new Error(`Byt ${update.unit.no} má viac ako jeden cieľový e-mail.`);
    unitTargets.add(update.unit.id);
  }
  return updates;
}

async function verifyAssignments(expectedAdminCount?: number) {
  const current = await currentRegistry();
  const updates = plannedUpdates(current);
  for (const update of updates) {
    if (update.writesUnit && update.unit.email?.toLowerCase() !== update.assignment.email) {
      throw new Error(`E-mail bytu ${update.assignment.unitNo} nebol uložený.`);
    }
    if (update.owner && update.owner.email?.toLowerCase() !== update.assignment.email) {
      throw new Error(`E-mail vlastníka bytu ${update.assignment.unitNo} nebol uložený.`);
    }
  }
  const unitEmailCount = current.building!.units.filter(unit => unit.email).length;
  const ownerEmailCount = current.building!.units.reduce(
    (count, unit) => count + unit.owners.filter(owner => owner.email).length,
    0,
  );
  const expectedUnitEmailCount = updates.filter(update => update.writesUnit).length;
  const expectedOwnerEmailCount = updates.filter(update => update.owner).length;
  if (unitEmailCount !== expectedUnitEmailCount || ownerEmailCount !== expectedOwnerEmailCount) {
    throw new Error("Register obsahuje neočakávané e-mailové priradenia.");
  }
  if (expectedAdminCount !== undefined && current.adminCount !== expectedAdminCount) {
    throw new Error("Počet administrátorských účtov sa počas priradenia zmenil.");
  }
  console.log(JSON.stringify({
    phase: "verified",
    assignmentCount: imported.assignmentCount,
    unitEmailCount,
    ownerEmailCount,
    fingerprint: imported.fingerprint,
  }));
}

async function main() {
  const current = await currentRegistry();
  const updates = plannedUpdates(current);
  const existingUnitEmailCount = current.building!.units.filter(unit => unit.email).length;
  const existingOwnerEmailCount = current.building!.units.reduce(
    (count, unit) => count + unit.owners.filter(owner => owner.email).length,
    0,
  );
  console.log(JSON.stringify({
    phase: "inspected",
    apply,
    verify,
    assignmentCount: imported.assignmentCount,
    existingUnitEmailCount,
    existingOwnerEmailCount,
    fingerprint: imported.fingerprint,
  }));

  if (verify) {
    await verifyAssignments();
    return;
  }
  if (!apply) return;
  if (process.env.CONFIRM_EMAIL_ASSIGNMENT !== "ASSIGN_TEN_VERIFIED_EMAILS") {
    throw new Error("Chýba presné potvrdenie produkčného priradenia.");
  }
  if (imported.assignmentCount !== 10) throw new Error("Import nemá očakávaných 10 priradení.");
  if (current.pollCount !== 0) throw new Error("E-maily sa nesmú hromadne meniť po vytvorení hlasovania.");
  if (existingUnitEmailCount !== 0 || existingOwnerEmailCount !== 0) {
    throw new Error("Pred prvým priradením musia byť e-mailové polia registra prázdne.");
  }

  await db.$transaction(async tx => {
    for (const update of updates) {
      if (update.writesUnit) {
        await tx.unit.update({ where: { id: update.unit.id }, data: { email: update.assignment.email } });
      }
      if (update.owner) {
        await tx.owner.update({ where: { id: update.owner.id }, data: { email: update.assignment.email } });
      }
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await verifyAssignments(current.adminCount);
}

main().finally(() => db.$disconnect());
