import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { PollStatus, MajorityType } from "@prisma/client";
import { generateVoteTokens } from "@/lib/tokens";
import { sendEmail, getInvitationEmailHtml } from "@/lib/email";
import { createAuditLogEntry } from "@/lib/hashChain";
import { createDriveFolder } from "@/lib/gdrive";

export async function POST(request: Request) {
  try {
    // 1. Verify admin session
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Neprihlásený administrátor." }, { status: 401 });
    }

    const building = await db.building.findFirst();
    if (!building) {
      return NextResponse.json({ error: "Budova nebola nájdená." }, { status: 404 });
    }

    const body = await request.json();
    const { basics, questions } = body as {
      basics: { title: string; reason: string; start: string; end: string };
      questions: Array<{ text: string; majority: string; note?: string }>;
    };

    if (!basics.title || !basics.reason || !basics.start || !basics.end) {
      return NextResponse.json({ error: "Základné údaje hlasovania sú povinné." }, { status: 400 });
    }

    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: "Hlasovanie musí obsahovať aspoň jednu otázku." }, { status: 400 });
    }

    // Create folder on Google Drive
    const dateString = basics.start ? basics.start.split("T")[0] : new Date().toISOString().split("T")[0];
    const folderName = `Podklady-hlasovanie-${dateString}`;
    const driveFolderId = await createDriveFolder(folderName);

    // 2. Perform Database creation inside a transaction
    const newPoll = await db.$transaction(async (tx) => {
      const poll = await tx.poll.create({
        data: {
          title: basics.title.trim(),
          reason: basics.reason.trim(),
          declarer: session.name,
          announcedAt: new Date(),
          startAt: new Date(basics.start),
          endAt: new Date(basics.end),
          status: PollStatus.active, // Set to active immediately
          driveFolderId,
          buildingId: building.id,
          questions: {
            create: questions.map((q, idx) => ({
              no: idx + 1,
              kind: "Spoločné",
              title: q.text.length > 40 ? q.text.slice(0, 37) + "..." : q.text,
              text: q.text.trim(),
              majorityType: q.majority as MajorityType,
              note: q.note?.trim() || null
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
    const formattedEnd = new Date(basics.end).toLocaleString("sk-SK", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    // Non-blocking email sending
    const emailPromises = tokensInfo.map(info => {
      const magicLink = `${baseUrl}/hlasuj/${info.token}`;
      const emailHtml = getInvitationEmailHtml(
        info.ownerName || "vlastník",
        building.name,
        newPoll.title,
        newPoll.reason,
        formattedEnd,
        magicLink
      );
      
      return sendEmail({
        to: info.email,
        subject: `Pozvánka na hlasovanie: ${newPoll.title}`,
        html: emailHtml
      });
    });

    // Run emails concurrently (errors caught inside helper)
    Promise.all(emailPromises).catch(err => {
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
