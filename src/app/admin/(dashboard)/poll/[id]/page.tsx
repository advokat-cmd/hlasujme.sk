import React from "react";
import { redirect, notFound } from "next/navigation";
import { getAdminSession, canReadBuilding } from "@/lib/session";
import { db } from "@/lib/db";
import { computePollResults } from "@/lib/engine";
import { PollDetailView } from "@/components/admin/PollDetailView";
import { getSealedQuestionTallies, parseSealedSnapshot } from "@/lib/seal";
import { canSeePollResults, pollStatusLabel } from "@/lib/pollPresentation";
import { PageHead } from "@/components/admin/PageHead";
import { Card } from "@/components/ui/Card";

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
      building: { select: { name: true } },
      sealedResult: true,
      protocolEmailLogs: session.role === "vlastnik" ? false : { orderBy: { sentAt: "desc" } }
    }
  });

  if (!poll || !(await canReadBuilding(session, poll.buildingId)) || (session.role === "vlastnik" && poll.status === "draft")) {
    notFound();
  }
  const isOwner = session.role === "vlastnik";
  if (!canSeePollResults(session.role, poll.status)) {
    const documents = await db.pollDocument.findMany({ where: { pollId }, select: { id: true, name: true } });
    return <div className="admin-page-container">
      <PageHead eyebrow={poll.building.name} title={poll.title} />
      <Card style={{ marginBottom: 20 }}>
        <p>{poll.reason}</p>
        <p>{pollStatusLabel(poll.status, poll.startAt.toISOString(), poll.endAt.toISOString())}</p>
        <p>Termín: {poll.startAt.toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" })} – {poll.endAt.toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" })}</p>
        <p>Hlasujte cez osobný odkaz v e-mailovej pozvánke. Priebežné výsledky vidí iba administrátor; vlastníkom sa sprístupnia po uzavretí.</p>
      </Card>
      {poll.questions.map(question => <Card key={question.id} style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 17 }}>{question.no}. {question.text}</h2>
      </Card>)}
      <Card><h2 style={{ fontSize: 17 }}>Podklady</h2>
        {documents.length === 0 ? <p>Bez príloh.</p> : documents.map(document => <p key={document.id}><a href={`/api/document/${document.id}`}>{document.name}</a></p>)}
      </Card>
    </div>;
  }
  const emailTemplates = isOwner ? [] : await db.emailTemplate.findMany();
  const isClosed = poll.status === "closed";
  const snapshot = isClosed && poll.sealedResult
    ? parseSealedSnapshot(poll.sealedResult.resultJson, poll.sealedResult.resultSha256) : null;
  const sealedQuestions = isClosed && poll.sealedResult
    ? getSealedQuestionTallies(poll.sealedResult.resultJson, poll.sealedResult.resultSha256) : [];

  // 3. Fetch Units & Owners
  const units = isOwner || isClosed ? [] : await db.unit.findMany({
    where: { buildingId: poll.buildingId, status: "active" },
    orderBy: { no: "asc" },
    include: { owners: true }
  });

  // 4. Calculate Question Tallies (batched — constant query count)
  const liveResults = isClosed ? null : await computePollResults(pollId);
  const tallies = liveResults?.tallies ?? new Map(sealedQuestions.map((question) => [question.no, question.tally]));
  const effectiveVotes = liveResults?.effectiveVotes;

  const questionsTallies = [];
  for (const q of snapshot?.questions ?? poll.questions) {
    const tally = tallies.get(q.no);
    if (!tally) continue;
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
  const votes = isOwner || isClosed ? [] : await db.vote.findMany({ where: { pollId } });
  const subvotes = isOwner || isClosed ? [] : await db.coownerSubvote.findMany({ where: { pollId } });
  const voteTokens = isOwner || isClosed ? [] : await db.voteToken.findMany({ where: { pollId }, orderBy: { createdAt: "desc" } });

  const votedUnitIds = new Set([
    ...votes.map(v => v.unitId),
    ...subvotes.map(sv => sv.unitId)
  ]);

  const unitVotesList = [];
  for (const u of units) {
    const unitAnswers = [];
    let isDisputedOnAny = false;

    // Get answer for each question (precomputed)
    for (const q of poll.questions) {
      const eff = effectiveVotes?.get(u.id)?.get(q.no) || { answer: null, disputed: false, note: null };
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
            email: o.email || u.email,
            ownerId: o.id,
            voted: subvotes.some(vote => vote.unitId === u.id && vote.ownerId === o.id),
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
      return u.owners.some(o => o.email || u.email);
    }
    return !!u.email;
  });

  const eligibleEmailsCount = unitsWithEmails.reduce((sum, u) => {
    if (u.coMode === "internal") {
      return sum + u.owners.filter(o => o.email || u.email).length;
    }
    return sum + 1;
  }, 0);

  const unvotedEmailsCount = unitsWithEmails.reduce((sum, u) => {
    if (u.coMode === "internal") {
      return sum + u.owners.filter(o => (o.email || u.email) && !subvotes.some(vote => vote.unitId === u.id && vote.ownerId === o.id)).length;
    }
    return sum + (votedUnitIds.has(u.id) ? 0 : 1);
  }, 0);

  const missingEmailsUnits = units.filter(u => {
    if (u.coMode === "internal") {
      return !u.owners.some(o => o.email || u.email);
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

  const historicalUnitVotes = !isOwner && snapshot ? snapshot.units.map((unit) => ({
    unitId: unit.id, unitNo: unit.no,
    ownerName: unit.actingPerson || unit.owners.map((owner) => owner.name).join(", ") || "Vlastník",
    coMode: unit.coMode,
    voted: unit.effectiveVotes.some((vote) => vote.answer !== null || vote.disputed),
    disputed: unit.effectiveVotes.some((vote) => vote.disputed),
    at: null, changed: false,
    answers: unit.effectiveVotes.map((vote) => ({ qNo: vote.questionNo, answer: vote.answer, disputed: vote.disputed, note: vote.note })),
    recipients: [],
  })) : [];

  return (
    <PollDetailView
      buildingName={snapshot?.poll.building.name ?? poll.building.name}
      eligibleUnitsCount={snapshot?.units.length ?? liveResults?.units.length ?? null}
      archiveNotice={isClosed && !snapshot ? "Starší archív obsahuje len súhrnné výsledky. Historický register a podrobné hlasy nájdete v pôvodnej PDF zápisnici." : undefined}
      poll={{
        id: poll.id,
        title: snapshot?.poll.title ?? poll.title,
        reason: snapshot?.poll.reason ?? poll.reason,
        declarer: snapshot?.poll.declarer ?? poll.declarer,
        announcedAt: snapshot?.poll.announcedAt ?? poll.announcedAt.toISOString(),
        startAt: snapshot?.poll.startAt ?? poll.startAt.toISOString(),
        endAt: snapshot?.poll.endAt ?? poll.endAt.toISOString(),
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
      unitVotesList={isClosed ? historicalUnitVotes : unitVotesList}
      emailStats={emailStats}
      userRole={session.role}
      emailTemplates={emailTemplates.map(t => ({ key: t.key, subject: t.subject, body: t.body }))}
    />
  );
}
