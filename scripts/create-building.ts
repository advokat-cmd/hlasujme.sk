import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Vytváram bytový dom Björnsonova 3...");

  const building = await prisma.building.create({
    data: {
      name: "Bytový dom Björnsonova 3",
      short: "Björnsonova 3",
      address: "Björnsonova 3, 811 05 Bratislava",
      entrance: "Vchod A",
      unitsCount: 0,
      manager: "Doplniť správcu",
      contact: "Doplniť kontakt",
      contactEmail: "doplnim@email.sk",
    }
  });

  console.log(`Bytový dom "${building.name}" bol úspešne vytvorený.`);
}

main()
  .catch((e) => {
    console.error("Chyba pri vytváraní bytového domu:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
