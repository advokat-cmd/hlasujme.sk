import { db } from "../src/lib/db";
import { PollStatus, MajorityType } from "@prisma/client";
import { generateSealedPdf } from "../src/lib/pdf";

async function main() {
  console.log("Testing close poll logic with 1 question...");
  
  // 1. Create a temporary poll with 1 question
  const tempPoll = await db.poll.create({
    data: {
      title: "Testovacie zatvorenie s 1 otazkou",
      reason: "Test",
      declarer: "Test",
      announcedAt: new Date(),
      startAt: new Date(),
      endAt: new Date(),
      status: PollStatus.active,
      buildingId: (await db.building.findFirst())!.id,
      questions: {
        create: [
          {
            no: 1,
            kind: "Test",
            title: "Otazka 1",
            text: "Suhlasite s testom?",
            majorityType: MajorityType.half_all
          }
        ]
      }
    }
  });

  try {
    console.log(`Created temp poll with ID: ${tempPoll.id}`);
    
    // 2. Generate PDF
    console.log("Generating PDF...");
    const pdfBuffer = await generateSealedPdf(tempPoll.id);
    console.log(`PDF generated: ${pdfBuffer.length} bytes`);
  } catch (err) {
    console.error("PDF generation failed:", err);
  } finally {
    // 3. Clean up
    console.log("Cleaning up temp poll...");
    await db.question.deleteMany({ where: { pollId: tempPoll.id } });
    await db.poll.delete({ where: { id: tempPoll.id } });
    console.log("Clean up finished.");
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
  });
