import React from "react";
import { redirect, notFound } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getEffectiveUnitVote, tallyQuestion } from "@/lib/engine";
import { PollDetailView } from "@/components/admin/PollDetailView";

export const revalidate = 0; // Ensure data is loaded fresh from database

export default async function AdminPollDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // 1. Verify admin session
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const { id: pollId } = await params;

  // 2. Fetch Poll and Questions
  const poll = await db.poll.findUnique({
    where: { id: pollId },
    include: {
      questions: { orderBy: { no: "asc" } },
      sealedResult: true,
      protocolEmailLogs: { orderBy: { sentAt: "desc" } }
    }
  });

  const emailTemplates = await db.emailTemplate.findMany();

  if (!poll) {
    notFound();
  }

  // 3. Fetch Units & Owners
  const units = await db.unit.findMany({
    where: { buildingId: poll.buildingId },
    orderBy: { no: "asc" },
    include: { owners: true }
  });

  // 4. Calculate Question Tallies
  const questionsTallies = [];
  for (const q of poll.questions) {
    const tally = await tallyQuestion(pollId, q.id);
    questionsTallies.push({
      id: q.id,
      no: q.no,
      kind: q.kind,
      title: q.title,
      text: q.text,
      majorityType: q.majorityType,
      note: q.note,
      attachments: q.attachments,
      tally
    });
  }

  // 5. Fetch Votes and Subvotes to build Unit Votes list
  const votes = await db.vote.findMany({ where: { pollId } });
  const subvotes = await db.coownerSubvote.findMany({ where: { pollId } });
  const voteTokens = await db.voteToken.findMany({ where: { pollId } });

  const votedUnitIds = new Set([
    ...votes.map(v => v.unitId),
    ...subvotes.map(sv => sv.unitId)
  ]);

  const unitVotesList = [];
  for (const u of units) {
    const unitAnswers = [];
    let isDisputedOnAny = false;

    // Get answer for each question
    for (const q of poll.questions) {
      const eff = await getEffectiveUnitVote(pollId, u.id, q.no);
      if (eff.disputed) {
        isDisputedOnAny = true;
      }
      unitAnswers.push({
        qNo: q.no,
        answer: eff.answer,
        disputed: eff.disputed,
        note: eff.note
      });
    }

    // Determine latest vote time / changed state for this unit
    let latestVoteTime: Date | null = null;
    let isChanged = false;

    if (u.coMode === "internal") {
      const uSubvotes = subvotes.filter(sv => sv.unitId === u.id);
      if (uSubvotes.length > 0) {
        latestVoteTime = new Date(Math.max(...uSubvotes.map(sv => sv.createdAt.getTime())));
        isChanged = uSubvotes.some(sv => sv.version > 1);
      }
    } else {
      const uVotes = votes.filter(v => v.unitId === u.id);
      if (uVotes.length > 0) {
        latestVoteTime = new Date(Math.max(...uVotes.map(v => v.createdAt.getTime())));
        isChanged = uVotes.some(v => v.version > 1);
      }
    }

    const ownerName = u.coMode === "rep" && u.actingPerson 
      ? u.actingPerson 
      : (u.owners.map(o => o.name).join(", ") || "Vlastník");

    const uTokens = voteTokens.filter(vt => vt.unitId === u.id);

    const recipients = u.coMode === "internal"
      ? u.owners.map(o => {
          const t = uTokens.find(vt => vt.ownerId === o.id);
          return {
            name: o.name,
            email: o.email,
            sentAt: t ? t.createdAt.toISOString() : null
          };
        })
      : (() => {
          const t = uTokens.find(vt => vt.ownerId === null);
          return [{
            name: ownerName,
            email: u.email,
            sentAt: t ? t.createdAt.toISOString() : null
          }];
        })();

    unitVotesList.push({
      unitId: u.id,
      unitNo: u.no,
      ownerName,
      coMode: u.coMode === "single" ? "Jediný vlastník" : u.coMode === "bsm" ? "BSM manželov" : u.coMode === "rep" ? "Určený zástupca" : u.coMode === "internal" ? "Interné hlasovanie" : u.coMode === "majority" ? "Väčšinový spoluvlastník" : "Právnická osoba",
      voted: votedUnitIds.has(u.id),
      disputed: isDisputedOnAny,
      at: latestVoteTime ? latestVoteTime.toISOString() : null,
      changed: isChanged,
      answers: unitAnswers,
      recipients
    });
  }

  // 6. Calculate Email statistics
  // A unit has emails if unit.email is not empty, OR if coMode is 'internal' and coowners have emails.
  const unitsWithEmails = units.filter(u => {
    if (u.coMode === "internal") {
      return u.owners.some(o => o.email);
    }
    return !!u.email;
  });

  const eligibleEmailsCount = unitsWithEmails.reduce((sum, u) => {
    if (u.coMode === "internal") {
      return sum + u.owners.filter(o => o.email).length;
    }
    return sum + 1;
  }, 0);

  const unvotedUnitsWithEmails = unitsWithEmails.filter(u => !votedUnitIds.has(u.id));
  const unvotedEmailsCount = unvotedUnitsWithEmails.reduce((sum, u) => {
    if (u.coMode === "internal") {
      return sum + u.owners.filter(o => o.email).length;
    }
    return sum + 1;
  }, 0);

  const missingEmailsUnits = units.filter(u => {
    if (u.coMode === "internal") {
      return !u.owners.some(o => o.email);
    }
    return !u.email;
  }).map(u => u.no);

  const emailStats = {
    eligibleEmailsCount,
    unvotedEmailsCount,
    votedCount: votedUnitIds.size,
    missingEmailsCount: missingEmailsUnits.length,
    missingEmailsUnits
  };

  return (
    <PollDetailView
      poll={{
        id: poll.id,
        title: poll.title,
        reason: poll.reason,
        declarer: poll.declarer,
        announcedAt: poll.announcedAt.toISOString(),
        startAt: poll.startAt.toISOString(),
        endAt: poll.endAt.toISOString(),
        status: poll.status,
        sealedResult: poll.sealedResult ? {
          pdfPath: poll.sealedResult.pdfPath,
          sha256: poll.sealedResult.sha256
        } : null,
        protocolEmailLogs: poll.protocolEmailLogs.map(l => ({
          id: l.id,
          email: l.email,
          sentAt: l.sentAt.toISOString()
        }))
      }}
      questions={questionsTallies}
      unitVotesList={unitVotesList}
      emailStats={emailStats}
      userRole={session.role}
      emailTemplates={emailTemplates.map(t => ({ key: t.key, subject: t.subject, body: t.body }))}
    />
  );
}
