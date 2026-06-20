"use client";

import React, { useState, useEffect } from "react";
import { IOSDevice } from "@/components/ui/IOSDevice";
import { Btn } from "@/components/ui/Button";
import { Pill, VOTE_STYLE } from "@/components/ui/Pill";
import { Card } from "@/components/ui/Card";
import { Ic } from "@/components/ui/Icons";
import { VoteAnswer } from "@prisma/client";

interface Question {
  id: string;
  no: number;
  kind: string;
  title: string;
  text: string;
  attachments: string[];
}

interface Unit {
  id: string;
  no: string;
  coMode: string;
  email: string | null;
  actingPerson: string | null;
}

interface Poll {
  id: string;
  title: string;
  reason: string;
  declarer: string;
  startAt: string;
  endAt: string;
  questions: Question[];
}

interface Owner {
  id: string;
  name: string;
  share: number;
  role: string;
}

interface VoterAppClientProps {
  token: string;
  poll: Poll;
  unit: Unit;
  owner: Owner | null;
  building: { name: string; address: string } | null;
  initialAnswers: Record<number, VoteAnswer>;
  initialSubmittedAt: string | null;
}

function formatSlovakDate(dateStr: string) {
  const d = new Date(dateStr);
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}. ${month}. ${year} o ${hours}:${minutes}`;
}

export function VoterAppClient({
  token,
  poll,
  unit,
  owner,
  building,
  initialAnswers,
  initialSubmittedAt,
}: VoterAppClientProps) {
  const [phase, setPhase] = useState<"intro" | "vote" | "recap" | "done">(
    initialSubmittedAt ? "done" : "intro"
  );
  const [answers, setAnswers] = useState<Record<number, VoteAnswer>>(initialAnswers);
  const [submittedAt, setSubmittedAt] = useState<string | null>(initialSubmittedAt);
  const [qi, setQi] = useState<number>(0);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 500);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  const setChoice = (no: number, val: VoteAnswer) => {
    setAnswers((prev) => ({ ...prev, [no]: val }));
    setSubmitError(null);
  };

  const allAnswered = poll.questions.every((q) => answers[q.no]);

  const submitVote = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/vote/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Nepodarilo sa odoslať hlasovanie.");
      } else {
        const nowFormatted = formatSlovakDate(new Date().toISOString());
        setSubmittedAt(nowFormatted);
        setPhase("done");
      }
    } catch (err) {
      setSubmitError("Chyba spojenia. Skontrolujte pripojenie k internetu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeVote = () => {
    setPhase("vote");
    setQi(0);
  };

  const voterName = owner
    ? owner.name
    : unit.actingPerson || "Vlastník";

  const appContent = (
    <div
      style={{
        minHeight: "100%",
        background: "var(--v-paper)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--sans)",
        color: "var(--ink)",
      }}
    >
      {phase === "intro" && (
        <VIntro
          poll={poll}
          unit={unit}
          building={building}
          voterName={voterName}
          inProgress={Object.keys(answers).length > 0}
          onStart={() => {
            setPhase("vote");
            setQi(0);
          }}
        />
      )}
      {phase === "vote" && (
        <VVote
          poll={poll}
          unit={unit}
          building={building}
          qi={qi}
          setQi={setQi}
          answers={answers}
          setChoice={setChoice}
          allAnswered={allAnswered}
          onRecap={() => setPhase("recap")}
        />
      )}
      {phase === "recap" && (
        <VRecap
          poll={poll}
          unit={unit}
          building={building}
          answers={answers}
          voterName={voterName}
          isSubmitting={isSubmitting}
          submitError={submitError}
          onBack={() => setPhase("vote")}
          onEdit={(idx) => {
            setQi(idx);
            setPhase("vote");
          }}
          onSubmit={submitVote}
          edited={!!submittedAt}
        />
      )}
      {phase === "done" && (
        <VDone
          token={token}
          poll={poll}
          unit={unit}
          building={building}
          voterName={voterName}
          submittedAt={submittedAt}
          answers={answers}
          onChange={changeVote}
        />
      )}
    </div>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--primary) 8%, var(--paper-2)), var(--paper-2))",
        padding: isMobile ? 0 : 20,
      }}
    >
      {!isMobile && (
        <div style={{ padding: "0 16px 14px", textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 13, color: "var(--ink-soft)", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Ic name="link" size={15} style={{ color: "var(--primary)" }} />
            Takto vidí hlasovanie vlastník po kliknutí na osobný link v e-maile
          </div>
        </div>
      )}

      {isMobile ? (
        <div style={{ width: "100%", height: "100vh", position: "relative" }}>
          {appContent}
        </div>
      ) : (
        <IOSDevice width={402} height={874}>
          {appContent}
        </IOSDevice>
      )}
    </div>
  );
}

// ── Shared Header ─────────────────────────────────────────────
interface VHeadProps {
  small?: boolean;
  building: { name: string; address: string } | null;
}
function VHead({ small, building }: VHeadProps) {
  return (
    <div
      style={{
        background: "var(--v-head)",
        color: "#fff",
        padding: small ? "52px 22px 16px" : "56px 22px 24px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: small ? 0 : 14 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "rgba(255,255,255,.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ic name="scale" size={17} style={{ color: "#fff" }} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.2 }}>
          Hlasovanie vlastníkov
        </div>
      </div>
      {!small && building && (
        <>
          <div style={{ fontFamily: "var(--serif)", fontSize: 21, fontWeight: 600, lineHeight: 1.2 }}>
            {building.name}
          </div>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.7)", marginTop: 3 }}>
            {building.address}
          </div>
        </>
      )}
    </div>
  );
}

// ── 1. Intro Screen ───────────────────────────────────────────
interface VIntroProps {
  poll: Poll;
  unit: Unit;
  building: { name: string; address: string } | null;
  voterName: string;
  inProgress: boolean;
  onStart: () => void;
}
function VIntro({ poll, unit, building, voterName, inProgress, onStart }: VIntroProps) {
  const endDateFormatted = formatSlovakDate(poll.endAt);
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <VHead building={building} />
      <div style={{ padding: "20px 22px", flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "13px 15px",
            borderRadius: 12,
            background: "var(--v-card)",
            border: "1px solid var(--v-line)",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: "var(--primary-bg)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--serif)",
              fontWeight: 700,
              fontSize: 17,
            }}
          >
            {unit.no}
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>Hlasujete za</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Byt č. {unit.no}</div>
            <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>Vlastník: {voterName}</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "11px 14px",
            borderRadius: 10,
            background: "var(--accent-bg)",
            color: "var(--accent-ink)",
            fontSize: 12.5,
            fontWeight: 600,
            marginBottom: 22,
          }}
        >
          <Ic name="clock" size={16} /> Hlasovanie je otvorené do {endDateFormatted}
        </div>

        <div style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 600, marginBottom: 4 }}>
          {poll.title}
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 18px", lineHeight: 1.5 }}>
          {poll.reason}. Hlasuje sa o {poll.questions.length} otázkach.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 20 }}>
          {poll.questions.map((q) => (
            <div
              key={q.no}
              style={{
                display: "flex",
                gap: 11,
                padding: "13px 14px",
                borderRadius: 11,
                background: "var(--v-card)",
                border: "1px solid var(--v-line)",
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: "var(--v-head)",
                  color: "#fff",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {q.no}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{q.title}</div>
                {q.attachments && q.attachments.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11.5,
                      color: "var(--primary)",
                      marginTop: 5,
                    }}
                  >
                    <Ic name="doc" size={13} /> {q.attachments.length}{" "}
                    {q.attachments.length === 1 ? "príloha" : "prílohy"} na stiahnutie
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 11.5, color: "var(--ink-faint)", lineHeight: 1.5, margin: "0 0 4px" }}>
          Za byt sa počíta jeden hlas. Do skončenia hlasovania môžete svoj hlas zmeniť — platí posledné
          odoslané hlasovanie.
        </p>
      </div>

      <div
        style={{
          padding: "14px 22px",
          borderTop: "1px solid var(--v-line)",
          background: "var(--v-paper)",
          position: "sticky",
          bottom: 0,
          zIndex: 10,
        }}
      >
        <Btn kind="primary" full size="lg" iconR="chevR" onClick={onStart}>
          {inProgress ? "Pokračovať v hlasovaní" : "Začať hlasovať"}
        </Btn>
      </div>
    </div>
  );
}

// ── 2. Voting Loop Screen ─────────────────────────────────────
interface VVoteProps {
  poll: Poll;
  unit: Unit;
  building: { name: string; address: string } | null;
  qi: number;
  setQi: React.Dispatch<React.SetStateAction<number>>;
  answers: Record<number, VoteAnswer>;
  setChoice: (no: number, val: VoteAnswer) => void;
  allAnswered: boolean;
  onRecap: () => void;
}
function VVote({
  poll,
  unit,
  building,
  qi,
  setQi,
  answers,
  setChoice,
  allAnswered,
  onRecap,
}: VVoteProps) {
  const q = poll.questions[qi];
  const choice = answers[q.no];
  const last = qi === poll.questions.length - 1;

  const next = () => {
    if (last) onRecap();
    else setQi(qi + 1);
  };

  const opt = (val: VoteAnswer, label: string, tone: "agree" | "disagree" | "abstain", icon: string, big: boolean) => {
    const active = choice === val;
    const tones = { agree: "var(--agree)", disagree: "var(--disagree)", abstain: "var(--abstain)" };
    const c = tones[tone];
    return (
      <button
        onClick={() => setChoice(q.no, val)}
        aria-pressed={active}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          width: "100%",
          padding: big ? "18px" : "13px",
          borderRadius: 13,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: big ? 17 : 14,
          fontWeight: 700,
          letterSpacing: 0.3,
          transition: "all .15s",
          border: "2px solid",
          borderColor: active ? c : "var(--v-line)",
          background: active ? c : "var(--v-card)",
          color: active ? "#fff" : big ? c : "var(--ink-soft)",
          boxShadow: active ? `0 6px 16px -6px ${c}` : "none",
        }}
      >
        <Ic name={icon} size={big ? 22 : 18} sw={2.6} />
        {label}
      </button>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <VHead small building={building} />
      {/* progress bar */}
      <div style={{ padding: "14px 22px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>
            Otázka {qi + 1} z {poll.questions.length}
          </span>
          <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>Byt č. {unit.no}</span>
        </div>
        <div aria-hidden="true" style={{ display: "flex", gap: 5 }}>
          {poll.questions.map((qq, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 999,
                background: answers[qq.no]
                  ? "var(--agree)"
                  : i === qi
                  ? "var(--primary)"
                  : "var(--v-line)",
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 22px", flex: 1 }}>
        <Pill tone="neutral" size="sm">
          {q.kind}
        </Pill>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600, margin: "12px 0 10px", lineHeight: 1.3 }}>
          {q.title}
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.55, margin: "0 0 16px" }}>
          {q.text}
        </p>

        {q.attachments && q.attachments.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 18 }}>
            {q.attachments.map((a, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "10px 12px",
                  borderRadius: 9,
                  background: "var(--v-card)",
                  border: "1px solid var(--v-line)",
                  fontSize: 12.5,
                }}
              >
                <Ic name="doc" size={16} style={{ color: "var(--primary)" }} />
                <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {a}
                </span>
                <Ic name="download" size={15} style={{ color: "var(--primary)" }} />
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {opt("agree", "SÚHLASÍM", "agree", "check", true)}
          {opt("disagree", "NESÚHLASÍM", "disagree", "x", true)}
          {opt("abstain", "Nechcem hlasovať", "abstain", "minus", false)}
        </div>
      </div>

      <div
        style={{
          padding: "14px 22px",
          borderTop: "1px solid var(--v-line)",
          display: "flex",
          gap: 10,
          position: "sticky",
          bottom: 0,
          background: "var(--v-paper)",
          zIndex: 10,
        }}
      >
        {qi > 0 && (
          <Btn kind="secondary" icon="chevL" ariaLabel="Predchádzajúca otázka" onClick={() => setQi(qi - 1)} />
        )}
        <Btn kind="primary" full iconR={last ? "check" : "chevR"} disabled={!choice} onClick={next}>
          {last ? "Skontrolovať a odoslať" : "Ďalšia otázka"}
        </Btn>
      </div>
    </div>
  );
}

// ── 3. Recap Screen ───────────────────────────────────────────
interface VRecapProps {
  poll: Poll;
  unit: Unit;
  building: { name: string; address: string } | null;
  answers: Record<number, VoteAnswer>;
  voterName: string;
  isSubmitting: boolean;
  submitError: string | null;
  onBack: () => void;
  onEdit: (idx: number) => void;
  onSubmit: () => void;
  edited: boolean;
}
function VRecap({
  poll,
  unit,
  building,
  answers,
  voterName,
  isSubmitting,
  submitError,
  onBack,
  onEdit,
  onSubmit,
  edited,
}: VRecapProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <VHead small building={building} />
      <div style={{ padding: "20px 22px", flex: 1 }}>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 19, fontWeight: 600, margin: "0 0 4px" }}>
          Rekapitulácia
        </h2>
        <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 18px" }}>
          Skontrolujte svoje odpovede pred odoslaním. Byt č. {unit.no} · Vlastník: {voterName}.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {poll.questions.map((q, idx) => {
            const val = answers[q.no] || "none";
            const v = VOTE_STYLE[val] || VOTE_STYLE.none;
            return (
              <div
                key={q.no}
                style={{
                  padding: "13px 14px",
                  borderRadius: 12,
                  background: "var(--v-card)",
                  border: "1px solid var(--v-line)",
                }}
              >
                <div style={{ display: "flex", gap: 9, marginBottom: 9 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-faint)" }}>
                    {q.no}.
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>
                    {q.title}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "6px 12px",
                      borderRadius: 999,
                      background: v.bg,
                      color: v.fg,
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    <Ic name={v.icon} size={15} sw={2.6} />
                    {v.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => onEdit(idx)}
                    aria-label={`Zmeniť odpoveď na otázku ${q.no}`}
                    style={{
                      fontSize: 12,
                      color: "var(--primary)",
                      fontWeight: 600,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px 8px",
                      borderRadius: 6,
                      textDecoration: "underline",
                    }}
                  >
                    Zmeniť
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {submitError && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: "12.5px",
              color: "var(--disagree)",
              marginTop: 14,
              padding: "8px 12px",
              background: "var(--disagree-bg)",
              borderRadius: 8,
            }}
          >
            <Ic name="alert" size={15} />
            {submitError}
          </div>
        )}

        <p style={{ fontSize: 11.5, color: "var(--ink-faint)", lineHeight: 1.5, marginTop: 18 }}>
          Po odoslaní si môžete stiahnuť potvrdenie. Svoj hlas môžete kedykoľvek zmeniť opätovným otvorením tohto odkazu až do ukončenia hlasovania.
        </p>
      </div>

      <div
        style={{
          padding: "14px 22px",
          borderTop: "1px solid var(--v-line)",
          display: "flex",
          gap: 10,
          position: "sticky",
          bottom: 0,
          background: "var(--v-paper)",
          zIndex: 10,
        }}
      >
        <Btn kind="secondary" icon="chevL" ariaLabel="Späť na otázky" onClick={onBack} disabled={isSubmitting} />
        <Btn kind="primary" full icon="send" onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting
            ? "Odosiela sa..."
            : edited
            ? "Odoslať zmenený hlas"
            : "Odoslať hlas"}
        </Btn>
      </div>
    </div>
  );
}

// ── 4. Done Screen ────────────────────────────────────────────
interface VDoneProps {
  token: string;
  poll: Poll;
  unit: Unit;
  building: { name: string; address: string } | null;
  voterName: string;
  submittedAt: string | null;
  answers: Record<number, VoteAnswer>;
  onChange: () => void;
}
function VDone({
  token,
  poll,
  unit,
  building,
  voterName,
  submittedAt,
  answers,
  onChange,
}: VDoneProps) {
  const downloadReceipt = () => {
    window.location.href = `/api/vote/${token}/pdf`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <VHead small building={building} />
      <div style={{ padding: "30px 22px 20px", flex: 1, textAlign: "center" }}>
        <div
          style={{
            width: 74,
            height: 74,
            borderRadius: 999,
            background: "var(--agree-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "4px auto 18px",
          }}
        >
          <Ic name="checkCircle" size={40} style={{ color: "var(--agree)" }} sw={2} />
        </div>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 21, fontWeight: 600, margin: "0 0 8px" }}>
          Váš hlas bol prijatý
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 4px", lineHeight: 1.5 }}>
          Byt č. {unit.no} · Vlastník: {voterName}
        </p>
        {submittedAt && (
          <p style={{ fontSize: 12.5, color: "var(--ink-faint)", margin: "0 0 14px" }}>
            Odoslané: {submittedAt}
          </p>
        )}
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 auto 20px", lineHeight: 1.5, maxWidth: 280 }}>
          Svoj hlas môžete zmeniť do skončenia hlasovania opätovným otvorením tohto odkazu.
        </p>

        <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 8 }}>
          {poll.questions.map((q) => {
            const val = answers[q.no] || "none";
            const v = VOTE_STYLE[val] || VOTE_STYLE.none;
            return (
              <div
                key={q.no}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "11px 13px",
                  borderRadius: 11,
                  background: "var(--v-card)",
                  border: "1px solid var(--v-line)",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-faint)" }}>
                  {q.no}.
                </span>
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, lineHeight: 1.25, marginRight: 8, textAlign: "left" }}>
                  {q.title}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    color: v.fg,
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  <Ic name={v.icon} size={14} sw={2.6} />
                  {v.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          padding: "14px 22px",
          borderTop: "1px solid var(--v-line)",
          display: "flex",
          flexDirection: "column",
          gap: 9,
          position: "sticky",
          bottom: 0,
          background: "var(--v-paper)",
          zIndex: 10,
        }}
      >
        <Btn kind="secondary" full icon="download" onClick={downloadReceipt}>
          Stiahnuť potvrdenie (PDF)
        </Btn>
        <Btn kind="ghost" full icon="edit" onClick={onChange}>
          Zmeniť môj hlas
        </Btn>
      </div>
    </div>
  );
}
