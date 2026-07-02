import { NextResponse } from "next/server";
import { validateVoteToken } from "@/lib/tokens";
import { db } from "@/lib/db";
import { VoteAnswer, Prisma } from "@prisma/client";
import { createAuditLogEntry } from "@/lib/hashChain";
import { checkRateLimit } from "@/lib/rateLimit";
import { sendEmail, getConfirmationEmail } from "@/lib/email";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const sourceIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

    // Limit vote submissions to 20 per minute per IP
    if (!checkRateLimit(sourceIp, 20, 60000)) {
      return NextResponse.json(
        { error: "Príliš veľa pokusov o hlasovanie. Skúste to znova o minútu." },
        { status: 429 }
      );
    }

    const { token } = await params;
    const body = await request.json();
    const { answers, finalize = false } = body as { answers: Record<string, VoteAnswer>; finalize?: boolean };

    if (!answers || typeof answers !== "object") {
      return NextResponse.json({ error: "Chybné údaje odpovedí." }, { status: 400 });
    }

    // 1. Validate magic link token
    const tokenInfo = await validateVoteToken(token);
    if (!tokenInfo) {
      return NextResponse.json({ error: "Neplatný alebo expirovaný odkaz na hlasovanie." }, { status: 401 });
    }

    const { tokenRecord, poll, unit, owner } = tokenInfo;

    if (finalize) {
      // Check that all questions in the poll are answered
      const unanswered = poll.questions.filter(q => !answers[String(q.no)]);
      if (unanswered.length > 0) {
        return NextResponse.json({
          error: `Nezodpovedané otázky: ${unanswered.map(q => q.no).join(", ")}`
        }, { status: 400 });
      }
    }

    // 2. Perform votes insertion inside a database transaction to ensure versioning integrity.
    // Concurrent submissions with the same token can race on the version unique
    // constraint (P2002) — retry once so the voter does not get a spurious error.
    const runVoteTransaction = () => db.$transaction(async (tx) => {
      for (const q of poll.questions) {
        const answer = answers[String(q.no)];
        if (!answer) continue;

        if (owner) {
          // Co-owner sub-vote
          const latestSubvote = await tx.coownerSubvote.findFirst({
            where: {
              pollId: poll.id,
              unitId: unit.id,
              ownerId: owner.id,
              questionNo: q.no
            },
            orderBy: { version: "desc" }
          });

          if (!latestSubvote || latestSubvote.answer !== answer) {
            const nextVersion = latestSubvote ? latestSubvote.version + 1 : 1;

            await tx.coownerSubvote.create({
              data: {
                pollId: poll.id,
                unitId: unit.id,
                ownerId: owner.id,
                questionNo: q.no,
                answer,
                version: nextVersion,
                sourceIp,
                tokenId: tokenRecord.id
              }
            });
          }
        } else {
          // Unit vote
          const latestVote = await tx.vote.findFirst({
            where: {
              pollId: poll.id,
              unitId: unit.id,
              questionNo: q.no
            },
            orderBy: { version: "desc" }
          });

          if (!latestVote || latestVote.answer !== answer) {
            const nextVersion = latestVote ? latestVote.version + 1 : 1;

            await tx.vote.create({
              data: {
                pollId: poll.id,
                unitId: unit.id,
                questionNo: q.no,
                answer,
                version: nextVersion,
                sourceIp,
                tokenId: tokenRecord.id
              }
            });
          }
        }
      }

      if (finalize) {
        // Mark token as used
        await tx.voteToken.update({
          where: { id: tokenRecord.id },
          data: { usedAt: new Date() }
        });
      }
    });

    try {
      await runVoteTransaction();
    } catch (txErr) {
      const isVersionConflict =
        txErr instanceof Prisma.PrismaClientKnownRequestError && txErr.code === "P2002";
      if (!isVersionConflict) throw txErr;
      await runVoteTransaction();
    }

    if (finalize) {
      // 3. Log to audit chain (outside the transaction, so if transaction commits, log is registered)
      const actorName = owner ? `${unit.no}/${owner.name}` : `${unit.no}/${unit.actingPerson || (unit.owners.length > 0 ? unit.owners.map(o => o.name).join(", ") : "Vlastník")}`;
      await createAuditLogEntry(
        "VOTE_CAST",
        `voter:${actorName}`,
        {
          message: `Hlasovanie odoslané vlastníkom pre byt č. ${unit.no}`,
          unitNo: unit.no,
          ownerName: owner?.name || null,
          coMode: unit.coMode,
          questions: Object.keys(answers).map(Number),
          answers,
          sourceIp
        }
      );

      // 4. Send Confirmation Email dynamically from DB template
      const targetEmail = owner?.email || unit.email;
      if (targetEmail && targetEmail.trim()) {
        const answersSummary = poll.questions.map(q => {
          const answer = answers[String(q.no)];
          return {
            qNo: q.no,
            qTitle: q.title,
            answerText: answer === "agree" ? "Súhlasím" : answer === "disagree" ? "Nesúhlasím" : answer === "abstain" ? "Zdržal sa" : "Nehlasoval"
          };
        });

        const dateFormatted = new Date().toLocaleString("sk-SK", {
          day: "numeric",
          month: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });

        try {
          const emailContent = await getConfirmationEmail({
            ownerName: owner?.name || unit.actingPerson || "vlastník",
            unitNo: unit.no,
            pollTitle: poll.title,
            dateFormatted,
            answersSummary
          });

          await sendEmail({
            to: targetEmail.trim(),
            subject: emailContent.subject,
            html: emailContent.html
          });
        } catch (emailErr) {
          console.error("Failed to send vote confirmation email:", emailErr);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Cast vote API error:", err);
    return NextResponse.json({ error: "Interná chyba servera pri zaznamenávaní hlasu." }, { status: 500 });
  }
}
