import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { PollStatus, MajorityType } from "@prisma/client";
import { generateVoteTokens } from "@/lib/tokens";
import { sendEmail, getInvitationEmail } from "@/lib/email";
import { createAuditLogEntry } from "@/lib/hashChain";
import { createDriveFolder } from "@/lib/gdrive";
import { validatePollInput } from "@/lib/security/input";

export async function POST(request: Request) {
  try {
    // 1. Verify admin session
    const session = await getAdminSession();
    if (!session || session.role === "vlastnik") {
      return NextResponse.json({ error: "Nedostatočné oprávnenia." }, { status: 403 });
    }

    const building = await db.building.findFirst();
    if (!building) {
      return NextResponse.json({ error: "Budova nebola nájdená." }, { status: 404 });
    }

    let input: ReturnType<typeof validatePollInput>;
    try {
      input = validatePollInput(await request.json());
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Neplatné údaje hlasovania." },
        { status: 400 }
      );
    }
    const { basics, questions } = input;

    const conflictingPoll = await db.poll.findFirst({
      where: { buildingId: building.id, status: { in: [PollStatus.active, PollStatus.closing] } },
      select: { id: true },
    });
    if (conflictingPoll) {
      return NextResponse.json({ error: "Pre tento dom už prebieha aktívne hlasovanie." }, { status: 409 });
    }

    // Create folder on Google Drive
    const dateString = basics.startAt.toISOString().split("T")[0];
    const folderName = `Podklady-hlasovanie-${dateString}`;
    const driveFolderId = await createDriveFolder(folderName);

    // 2. Perform Database creation inside a transaction
    const newPoll = await db.$transaction(async (tx) => {
      const poll = await tx.poll.create({
        data: {
          title: basics.title,
          reason: basics.reason,
          declarer: session.name,
          announcedAt: new Date(),
          startAt: basics.startAt,
          endAt: basics.endAt,
          status: PollStatus.active, // Set to active immediately
          driveFolderId,
          buildingId: building.id,
          questions: {
            create: questions.map((q, idx) => ({
              no: idx + 1,
              kind: "Spoločné",
              title: q.text.length > 40 ? q.text.slice(0, 37) + "..." : q.text,
              text: q.text,
              majorityType: (q.majority === "half-all" ? "half_all" :
                             q.majority === "twothirds-all" ? "twothirds_all" :
                             q.majority === "fourfifths-all" ? "fourfifths_all" :
                             q.majority === "half-present" ? "half_present" :
                             q.majority) as MajorityType,
              note: q.note
            }))
          }
        }
      });

      return poll;
    });

    // 3. Generate magic links
    const tokensInfo = await generateVoteTokens(newPoll.id);

    // 4. Dispatch invitation emails in the background (using Promise.all or async loop)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const formattedEnd = basics.endAt.toLocaleString("sk-SK", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    // Non-blocking email sending
    const sendEmailsAsync = async () => {
      const emailPromises = tokensInfo.map(async info => {
        const magicLink = `${baseUrl}/hlasuj/${info.token}`;
        const emailContent = await getInvitationEmail({
          ownerName: info.ownerName || "vlastník",
          buildingName: building.name,
          pollTitle: newPoll.title,
          pollReason: newPoll.reason,
          endFormatted: formattedEnd,
          magicLink
        });
        
        return sendEmail({
          to: info.email,
          subject: emailContent.subject,
          html: emailContent.html
        });
      });
      await Promise.all(emailPromises);
    };

    sendEmailsAsync().catch(err => {
      console.error("Error in background email dispatch:", err);
    });

    // 5. Add audit log
    await createAuditLogEntry(
      "POLL_CREATED",
      `admin:${session.email}`,
      {
        message: `Bolo vyhlásené nové hlasovanie "${newPoll.title}".`,
        pollId: newPoll.id,
        title: newPoll.title,
        questionsCount: questions.length,
        recipientsCount: tokensInfo.length
      }
    );

    return NextResponse.json({ success: true, pollId: newPoll.id });
  } catch (err) {
    console.error("Poll create API error:", err);
    return NextResponse.json({ error: "Nepodarilo sa vytvoriť hlasovanie." }, { status: 500 });
  }
}
