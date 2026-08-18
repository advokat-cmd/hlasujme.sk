import { CoMode, OwnerRole, Prisma, UnitType } from "@prisma/client";
import { db } from "../src/lib/db";
import { validateRegisterImport } from "../src/lib/maintenance/registerImport";

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
  throw new Error("Import je povolený iba pre databázu lemon a schému hlasujme.");
}

const encodedPayload = process.env.REGISTER_IMPORT_PAYLOAD_B64;
if (!encodedPayload) throw new Error("Chýba importný payload.");
const imported = validateRegisterImport(JSON.parse(Buffer.from(encodedPayload, "base64").toString("utf8")));
if (process.env.EXPECTED_IMPORT_FINGERPRINT && process.env.EXPECTED_IMPORT_FINGERPRINT !== imported.fingerprint) {
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
  const [buildingCount, ownerCount, adminCount] = await Promise.all([
    db.building.count(),
    db.owner.count(),
    db.admin.count(),
  ]);
  return { building, buildingCount, ownerCount, adminCount };
}

async function verifyImportedRegistry(expectedAdminCount?: number) {
  const current = await currentRegistry();
  if (!current.building || current.buildingCount !== 1) throw new Error("Očakáva sa práve jeden bytový dom.");
  const actual = validateRegisterImport({
    buildingEntrance: current.building.entrance,
    units: current.building.units.map(unit => ({
      no: unit.no,
      type: unit.type,
      floor: unit.floor,
      label: unit.label,
      coMode: unit.coMode,
      email: unit.email,
      owners: unit.owners.map(owner => ({
        first: owner.first,
        last: owner.last,
        birthDate: owner.birthDate,
        share: owner.share,
        role: owner.role,
        email: owner.email,
      })),
    })),
  });
  if (actual.fingerprint !== imported.fingerprint) throw new Error("Importované údaje sa nezhodujú so zdrojom.");
  if (expectedAdminCount !== undefined && current.adminCount !== expectedAdminCount) {
    throw new Error("Počet administrátorských účtov sa počas importu zmenil.");
  }
  console.log(JSON.stringify({ phase: "verified", unitCount: actual.unitCount, ownerCount: actual.ownerCount, fingerprint: actual.fingerprint }));
}

async function main() {
  const current = await currentRegistry();
  if (!current.building || current.buildingCount !== 1) throw new Error("Očakáva sa práve jeden bytový dom.");
  if (current.building.entrance.trim() !== imported.payload.buildingEntrance) throw new Error("Import patrí inému vchodu.");
  console.log(JSON.stringify({
    phase: "inspected",
    apply,
    verify,
    existingUnits: current.building.units.length,
    existingOwners: current.ownerCount,
    targetUnits: imported.unitCount,
    targetOwners: imported.ownerCount,
    fingerprint: imported.fingerprint,
  }));

  if (verify) {
    await verifyImportedRegistry();
    return;
  }
  if (!apply) return;
  if (process.env.CONFIRM_REGISTER_IMPORT !== "IMPORT_TWELVE_UNITS_SEVENTEEN_OWNERS") {
    throw new Error("Chýba presné potvrdenie produkčného importu.");
  }
  if (imported.unitCount !== 12 || imported.ownerCount !== 17) throw new Error("Import nemá očakávaných 12 bytov a 17 vlastníkov.");
  if (current.building.units.length !== 0 || current.ownerCount !== 0) throw new Error("Register musí byť pred importom prázdny.");

  await db.$transaction(async tx => {
    for (const unit of imported.payload.units) {
      await tx.unit.create({
        data: {
          no: unit.no,
          type: unit.type as UnitType,
          floor: unit.floor,
          votes: 1,
          coMode: unit.coMode as CoMode,
          email: null,
          label: unit.label,
          buildingId: current.building!.id,
          owners: {
            create: unit.owners.map(owner => ({
              first: owner.first,
              last: owner.last,
              name: `${owner.first} ${owner.last}`,
              email: null,
              phone: null,
              birthDate: owner.birthDate,
              share: owner.share,
              role: owner.role as OwnerRole,
            })),
          },
        },
      });
    }
    await tx.building.update({ where: { id: current.building!.id }, data: { unitsCount: imported.unitCount } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await verifyImportedRegistry(current.adminCount);
}

main().finally(() => db.$disconnect());
