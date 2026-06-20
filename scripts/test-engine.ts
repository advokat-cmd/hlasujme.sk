import { PrismaClient } from "@prisma/client";
import { tallyQuestion, getEffectiveUnitVote } from "../src/lib/engine";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Running server-side voting engine tests...");

  const pollId = "poll-2026-03";
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { questions: true }
  });

  if (!poll) {
    console.error("Test poll poll-2026-03 not found. Did you run the database seed?");
    process.exit(1);
  }

  // Find questions
  const q1 = poll.questions.find(q => q.no === 1);
  const q2 = poll.questions.find(q => q.no === 2);
  const q3 = poll.questions.find(q => q.no === 3);

  if (!q1 || !q2 || !q3) {
    console.error("Poll questions not found.");
    process.exit(1);
  }

  let failed = false;

  // Test Q1
  const t1 = await tallyQuestion(pollId, q1.id);
  console.log(`Q1 Tally: agree=${t1.agree}, need=${t1.need}, status=${t1.status}`);
  if (t1.agree !== 19 || t1.need !== 19 || t1.status !== "approved") {
    console.error("❌ Q1 verification failed!");
    failed = true;
  } else {
    console.log("✅ Q1 verification passed.");
  }

  // Test Q2
  const t2 = await tallyQuestion(pollId, q2.id);
  console.log(`Q2 Tally: agree=${t2.agree}, need=${t2.need}, status=${t2.status}`);
  if (t2.agree !== 18 || t2.need !== 19 || t2.status !== "short") {
    console.error("❌ Q2 verification failed!");
    failed = true;
  } else {
    console.log("✅ Q2 verification passed.");
  }

  // Test Q3
  const t3 = await tallyQuestion(pollId, q3.id);
  console.log(`Q3 Tally: agree=${t3.agree}, need=${t3.need}, status=${t3.status}`);
  if (t3.agree !== 10 || t3.need !== 24 || t3.status !== "short") {
    console.error("❌ Q3 verification failed!");
    failed = true;
  } else {
    console.log("✅ Q3 verification passed.");
  }

  // Test Unit 12 dispute status
  const u12 = await prisma.unit.findFirst({
    where: { no: "12" }
  });
  if (!u12) {
    console.error("Unit 12 not found in database.");
    process.exit(1);
  }

  const v12_q1 = await getEffectiveUnitVote(pollId, u12.id, 1);
  const v12_q2 = await getEffectiveUnitVote(pollId, u12.id, 2);
  const v12_q3 = await getEffectiveUnitVote(pollId, u12.id, 3);

  console.log(`Unit 12 effective votes: Q1 disputed=${v12_q1.disputed}, Q2 disputed=${v12_q2.disputed}, Q3 disputed=${v12_q3.disputed}`);
  if (v12_q1.disputed !== false || v12_q2.disputed !== true || v12_q3.disputed !== true) {
    console.error("❌ Unit 12 dispute status verification failed!");
    failed = true;
  } else {
    console.log("✅ Unit 12 dispute status verification passed.");
  }

  // Tally overall disputed units (count of units that have disputed votes on ANY question)
  const units = await prisma.unit.findMany({
    where: { buildingId: poll.buildingId }
  });

  let disputedCount = 0;
  for (const u of units) {
    const isDisputedOnAny = (
      (await getEffectiveUnitVote(pollId, u.id, 1)).disputed ||
      (await getEffectiveUnitVote(pollId, u.id, 2)).disputed ||
      (await getEffectiveUnitVote(pollId, u.id, 3)).disputed
    );
    if (isDisputedOnAny) {
      disputedCount++;
    }
  }

  console.log(`Disputed units count: ${disputedCount}`);
  if (disputedCount !== 1) {
    console.error("❌ Disputed units count verification failed! Expected 1, got " + disputedCount);
    failed = true;
  } else {
    console.log("✅ Disputed units count verification passed.");
  }

  if (failed) {
    console.error("❌ Some engine tests failed!");
    process.exit(1);
  } else {
    console.log("🎉 All voting engine tests passed successfully!");
    process.exit(0);
  }
}

runTests()
  .catch((e) => {
    console.error("Verification script crashed: ", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
