import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { MajorityType } from "@prisma/client";
import { createAuditLogEntryWithTx } from "@/lib/hashChain";
import { validatePollInput } from "@/lib/security/input";

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || session.role === "vlastnik") return NextResponse.json({ error: "Nedostatočné oprávnenia." }, { status: 403 });
    const building = await db.building.findFirst();
    if (!building) return NextResponse.json({ error: "Budova nebola nájdená." }, { status: 404 });
    let input: ReturnType<typeof validatePollInput>;
    try { input = validatePollInput(await request.json()); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Neplatné údaje hlasovania." }, { status: 400 }); }
    const { basics, questions } = input;
    const poll = await db.$transaction(async tx => {
      const created = await tx.poll.create({ data: {
        title: basics.title, reason: basics.reason, declarer: session.name,
        announcedAt: new Date(), startAt: basics.startAt, endAt: basics.endAt,
        status: "draft", buildingId: building.id,
        questions: { create: questions.map((question, index) => ({
          no: index + 1, kind: "Spoločné", title: question.text.length > 40 ? question.text.slice(0, 37) + "..." : question.text,
          text: question.text, majorityType: question.majority.replaceAll("-", "_") as MajorityType, note: question.note,
        })) },
      } });
      await createAuditLogEntryWithTx(tx, "POLL_DRAFT_CREATED", "admin:" + session.email, {
        message: 'Bol pripravený návrh hlasovania "' + created.title + '".', pollId: created.id, questionsCount: questions.length,
      });
      return created;
    });
    // Finish document uploads before activation publishes the poll and its links.
    return NextResponse.json({ success: true, pollId: poll.id, status: poll.status });
  } catch (error) {
    console.error("Poll create API error:", error);
    return NextResponse.json({ error: "Nepodarilo sa vytvoriť návrh hlasovania." }, { status: 500 });
  }
}
