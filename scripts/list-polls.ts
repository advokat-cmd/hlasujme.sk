import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const polls = await prisma.poll.findMany({
    include: {
      questions: true,
      sealedResult: true
    }
  });

  console.log("--- POLLS ---");
  for (const p of polls) {
    console.log(`ID: ${p.id}, Title: "${p.title}", Status: ${p.status}, Questions: ${p.questions.length}, Has Sealed: ${!!p.sealedResult}`);
  }
  console.log("-------------");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
