import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.admin.findMany({ select: { email: true, name: true } });
  const buildings = await prisma.building.findMany({ select: { name: true } });
  console.log("--- DB STATUS ---");
  console.log("Počet administrátorov:", admins.length, admins);
  console.log("Počet budov:", buildings.length, buildings);
  console.log("-----------------");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
