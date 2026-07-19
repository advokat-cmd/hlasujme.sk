import { NextResponse } from "next/server";
import { isPollOpen, validateVoteToken } from "@/lib/tokens";
import { db } from "@/lib/db";
import { VoteAnswer } from "@prisma/client";
import { createAuditLogEntryWithTx } from "@/lib/hashChain";
import { consumeRateLimit, privateRateLimitKey } from "@/lib/security/rateLimit";
import { getClientIp } from "@/lib/security/clientIp";
import { sendEmail, getConfirmationEmail } from "@/lib/email";
import { parseVoteAnswers } from "@/lib/security/input";
import { acquirePollLock } from "@/lib/pollLock";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const sourceIp = getClientIp(request.headers);

    // Limit vote submissions to 20 per minute per IP
    const rateLimit = await consumeRateLimit({ action: "vote", key: privateRateLimitKey(sourceIp), limit: 20, windowMs: 60000 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Príliš veľa pokusov o hlasovanie. Skúste to znova o minútu." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    const { token } = await params;
    const body = await request.json() as { answers?: unknown; finalize?: unknown };
    const finalize = body.finalize === true;

    // 1. Validate magic link token
    const tokenInfo = await validateVoteToken(token);
    if (!tokenInfo) {
      return NextResponse.json({ error: "Neplatný alebo expirovaný odkaz na hlasovanie." }, { status: 401 });
    }

    const { tokenRecord, poll, unit, owner } = tokenInfo;
    let answers: Record<number, VoteAnswer>;
    try {
      answers = parseVoteAnswers(body.answers, new Set(poll.questions.map(question => question.no))) as Record<number, VoteAnswer>;
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Chybné údaje odpovedí." }, { status: 400 });
    }

    if (finalize) {
      // Check that all questions in the poll are answered
      const unanswered = poll.questions.filter(q => !answers[q.no]);
      if (unanswered.length > 0) {
        return NextResponse.json({
          error: `Nezodpovedané otázky: ${unanswered.map(q => q.no).join(", ")}`
        }, { status: 400 });
      }
    }

    // 2. Serialize vote writes with poll closing and re-check mutable state under the lock.
    const runVoteTransaction = () => db.$transaction(async (tx) => {
      await acquirePollLock(tx, poll.id);
      const lockedToken = await tx.voteToken.findUnique({
        where: { id: tokenRecord.id },
        include: { poll: true, unit: { include: { owners: true } } },
      });
      const lockedNow = new Date();
      if (
        !lockedToken ||
        lockedToken.expiresAt < lockedNow ||
        !isPollOpen(lockedToken.poll, lockedNow) ||
        lockedToken.pollId !== poll.id ||
        lockedToken.unitId !== unit.id ||
        lockedToken.unit.buildingId !== lockedToken.poll.buildingId ||
        (lockedToken.ownerId && !lockedToken.unit.owners.some(item => item.id === lockedToken.ownerId))
      ) {
        throw new Error("POLL_NOT_OPEN");
      }
      const changedQuestions: number[] = [];
      for (const q of poll.questions) {
        const answer = answers[q.no];
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
            changedQuestions.push(q.no);
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
            changedQuestions.push(q.no);
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
      if (changedQuestions.length > 0 || finalize) {
        const actorName = owner
          ? `${unit.no}/${owner.name}`
          : `${unit.no}/${unit.actingPerson || unit.owners.map(item => item.name).join(", ") || "Vlastník"}`;
        await createAuditLogEntryWithTx(
          tx,
          finalize ? "VOTE_CAST" : "VOTE_VERSION_SAVED",
          `voter:${actorName}`,
          {
            message: finalize ? `Hlasovanie odoslané pre jednotku č. ${unit.no}.` : `Priebežná verzia hlasu uložená pre jednotku č. ${unit.no}.`,
            pollId: poll.id,
            unitId: unit.id,
            ownerId: owner?.id ?? null,
            questions: changedQuestions,
            finalized: finalize,
            sourceIp,
          }
        );
      }
    });

    try {
      await runVoteTransaction();
    } catch (txErr) {
      if (txErr instanceof Error && txErr.message === "POLL_NOT_OPEN") {
        return NextResponse.json({ error: "Hlasovanie nie je otvorené." }, { status: 409 });
      }
      throw txErr;
    }

    if (finalize) {
      // 3. Send confirmation email after the authoritative vote + audit commit.
      const targetEmail = owner?.email || unit.email;
      if (targetEmail && targetEmail.trim()) {
        const answersSummary = poll.questions.map(q => {
          const answer = answers[q.no];
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
