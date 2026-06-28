import React from "react";
import { validateVoteToken } from "@/lib/tokens";
import { db } from "@/lib/db";
import { VoterAppClient } from "./VoterAppClient";
import { Card } from "@/components/ui/Card";
import { Ic } from "@/components/ui/Icons";
import { VoteAnswer } from "@prisma/client";
import { listFilesInFolder } from "@/lib/gdrive";

interface PageProps {
  params: Promise<{ token: string }>;
}

function formatSlovakDate(date: Date) {
  return date.toLocaleString("sk-SK", {
    timeZone: "Europe/Bratislava",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).replace(",", " o");
}

export default async function VoterPage({ params }: PageProps) {
  const { token } = await params;

  // 1. Validate the vote token hash
  const tokenInfo = await validateVoteToken(token);

  if (!tokenInfo) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--primary) 9%, var(--paper-2)), var(--paper-2))",
        }}
      >
        <Card style={{ width: 400, maxWidth: "100%", textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              background: "var(--disagree-bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <Ic name="alert" size={28} style={{ color: "var(--disagree)" }} />
          </div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>
            Neplatný odkaz
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--ink-soft)", margin: "0 0 16px", lineHeight: 1.5 }}>
            Tento odkaz na hlasovanie je neplatný, vypršala jeho platnosť, alebo už bolo hlasovanie uzavreté administrátorom.
          </p>
          <p style={{ fontSize: 12, color: "var(--ink-faint)", margin: 0 }}>
            Skontrolujte svoju e-mailovú schránku pre najnovšiu pozvánku alebo kontaktujte správcu bytového domu.
          </p>
        </Card>
      </div>
    );
  }

  const { poll, unit, owner } = tokenInfo;

  // Check if poll has not started yet
  const now = new Date();
  if (poll.startAt > now) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--primary) 9%, var(--paper-2)), var(--paper-2))",
        }}
      >
        <Card style={{ width: 440, maxWidth: "100%", textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              background: "var(--primary-bg)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <Ic name="clock" size={28} />
          </div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>
            Hlasovanie sa ešte nezačalo
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--ink-soft)", margin: "0 0 16px", lineHeight: 1.5 }}>
            Toto elektronické hlasovanie je naplánované a bude prístupné od:<br/>
            <strong>{formatSlovakDate(poll.startAt)}</strong>
          </p>
          <p style={{ fontSize: 12, color: "var(--ink-faint)", margin: 0 }}>
            Po tomto čase stačí túto stránku obnoviť a budete môcť odovzdať svoj hlas.
          </p>
        </Card>
      </div>
    );
  }

  // 2. Fetch building info
  const building = await db.building.findUnique({
    where: { id: unit.buildingId },
    select: { name: true, address: true }
  });

  // 3. Fetch latest voting state
  const initialAnswers: Record<number, VoteAnswer> = {};
  let lastVoteDate: Date | null = null;

  if (owner) {
    // Co-owner subvotes
    const subvotes = await db.coownerSubvote.findMany({
      where: { pollId: poll.id, unitId: unit.id, ownerId: owner.id },
      orderBy: [{ questionNo: "asc" }, { version: "desc" }]
    });
    const latestMap = new Map<number, { answer: VoteAnswer; date: Date }>();
    for (const sv of subvotes) {
      if (!latestMap.has(sv.questionNo)) {
        latestMap.set(sv.questionNo, { answer: sv.answer, date: sv.createdAt });
      }
    }
    latestMap.forEach((v, qNo) => {
      initialAnswers[qNo] = v.answer;
      if (!lastVoteDate || v.date > lastVoteDate) {
        lastVoteDate = v.date;
      }
    });
  } else {
    // Unit votes
    const votes = await db.vote.findMany({
      where: { pollId: poll.id, unitId: unit.id },
      orderBy: [{ questionNo: "asc" }, { version: "desc" }]
    });
    const latestMap = new Map<number, { answer: VoteAnswer; date: Date }>();
    for (const v of votes) {
      if (!latestMap.has(v.questionNo)) {
        latestMap.set(v.questionNo, { answer: v.answer, date: v.createdAt });
      }
    }
    latestMap.forEach((v, qNo) => {
      initialAnswers[qNo] = v.answer;
      if (!lastVoteDate || v.date > lastVoteDate) {
        lastVoteDate = v.date;
      }
    });
  }

  // 4. Serialize data structures to bypass Date object transmission errors to client component
  const driveFiles = poll.driveFolderId ? await listFilesInFolder(poll.driveFolderId) : [];

  const serializedPoll = {
    id: poll.id,
    title: poll.title,
    reason: poll.reason,
    declarer: poll.declarer,
    startAt: poll.startAt.toISOString(),
    endAt: poll.endAt.toISOString(),
    files: driveFiles,
    questions: poll.questions.map((q) => ({
      id: q.id,
      no: q.no,
      kind: q.kind,
      title: q.title,
      text: q.text,
      attachments: q.attachments,
    })),
  };

  const serializedUnit = {
    id: unit.id,
    no: unit.no,
    coMode: unit.coMode,
    email: unit.email,
    actingPerson: unit.actingPerson,
  };

  const serializedOwner = owner
    ? {
        id: owner.id,
        name: owner.name,
        share: owner.share,
        role: owner.role,
      }
    : null;

  const initialSubmittedAtFormatted = lastVoteDate ? formatSlovakDate(lastVoteDate) : null;

  return (
    <VoterAppClient
      token={token}
      poll={serializedPoll}
      unit={serializedUnit}
      owner={serializedOwner}
      building={building}
      initialAnswers={initialAnswers}
      initialSubmittedAt={initialSubmittedAtFormatted}
    />
  );
}
