import { PrismaClient } from "@prisma/client";
import { assertSafeDestructiveDatabase } from "./check-db-boundary";

const prisma = new PrismaClient();

async function main() {
  assertSafeDestructiveDatabase();
  console.log("Čistím izolovanú testovaciu schému Hlasujme...");

  await prisma.sealedResult.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.coownerSubvote.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.voteToken.deleteMany();
  await prisma.question.deleteMany();
  await prisma.poll.deleteMany();
  await prisma.owner.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.building.deleteMany();

  console.log("Testovacia schéma bola úspešne vyčistená.");
}

main()
  .catch((error) => {
    console.error("Chyba pri čistení databázy:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
