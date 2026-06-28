import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Čistím databázu (hlasovania, otázky, hlasy, vlastníci, byty, budovy)...");
  
  // 1. Zmazať výsledky a auditné záznamy
  await prisma.sealedResult.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.coownerSubvote.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.voteToken.deleteMany();
  
  // 2. Zmazať otázky a hlasovania
  await prisma.question.deleteMany();
  await prisma.poll.deleteMany();
  
  // 3. Zmazať vlastníkov, byty a administrátorov
  await prisma.owner.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.unit.deleteMany();
  
  // 4. Zmazať budovy
  await prisma.building.deleteMany();

  console.log("Databáza bola úspešne vyčistená (vrátane všetkých administrátorov).");
}

main()
  .catch((e) => {
    console.error("Chyba pri čistení databázy:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
