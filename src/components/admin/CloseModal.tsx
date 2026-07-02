"use client";

import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { Btn } from "../ui/Button";
import { Ic } from "../ui/Icons";
import { Pill } from "../ui/Pill";

interface QuestionSummary {
  no: number;
  title: string;
  agree: number;
  need: number;
  status: "approved" | "rejected" | "short";
}

interface ConflictChecks {
  disputedUnitsCount: number;
  disputedUnitsList: string[];
  missingEmailsCount: number;
  missingEmailsList: string[];
}

interface CloseModalProps {
  pollId: string;
  pollTitle: string;
  questions: QuestionSummary[];
  conflictChecks: ConflictChecks;
  onClose: () => void;
  onSuccess: () => void;
}

export const CloseModal: React.FC<CloseModalProps> = ({
  pollId,
  pollTitle,
  questions,
  conflictChecks,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClosePoll = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/poll/${pollId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Nepodarilo sa uzavrieť hlasovanie.");
      } else {
        if (data.driveError) {
          alert(`Hlasovanie bolo uzavreté, ale záloha zápisnice na Google Drive zlyhala: ${data.driveError}\n\nZápisnicu môžete nahrať znova v detaile hlasovania tlačidlom „Nahrať na Drive".`);
        }
        onSuccess();
      }
    } catch (err) {
      setError("Chyba sieťového pripojenia.");
    } finally {
      setLoading(false);
    }
  };

  const checks = [
    { ok: true, t: "Každá otázka má priradený typ väčšiny" },
    { ok: true, t: "Všetci vlastníci sú priradení k jednotkám" },
    { ok: true, t: "Žiadne duplicitné e-mailové adresy" },
    ...conflictChecks.disputedUnitsList.map(t => ({ ok: false, t })),
    ...conflictChecks.missingEmailsList.map(t => ({ ok: false, t })),
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,26,38,.5)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Uzavretie hlasovania"
        style={{
          width: 540,
          maxWidth: "100%",
          background: "var(--surface)",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 30px 80px -20px rgba(0,0,0,.5)",
        }}
      >
        <div style={{ padding: "22px 26px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12 }}>
          <Ic name={step === 0 ? "shield" : "paper"} size={22} style={{ color: "var(--accent-ink)" }} />
          <div>
            <h3 style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600, margin: 0 }}>
              {step === 0 ? "Kontrola pred uzavretím" : "Dvojitá kontrola výsledkov"}
            </h3>
            <div style={{ fontSize: "12.5px", color: "var(--ink-soft)" }}>
              {step === 0 ? "Pred uzamknutím hlasovania" : "Pred odoslaním výsledkov vlastníkom"}
            </div>
          </div>
        </div>

        <div style={{ padding: "22px 26px" }}>
          {error && (
            <div style={{ color: "var(--disagree)", fontSize: "13.5px", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <Ic name="alert" size={17} />
              {error}
            </div>
          )}

          {step === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {checks.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "13.5px" }}>
                  <Ic
                    name={c.ok ? "checkCircle" : "alert"}
                    size={18}
                    style={{ color: c.ok ? "var(--agree)" : "var(--accent-ink)", flexShrink: 0, marginTop: 1 }}
                  />
                  <span style={{ color: c.ok ? "var(--ink)" : "var(--accent-ink)" }}>{c.t}</span>
                </div>
              ))}
              <div
                style={{
                  fontSize: "12.5px",
                  color: "var(--ink-soft)",
                  marginTop: 6,
                  lineHeight: 1.5,
                  background: "var(--paper-2)",
                  padding: "10px 12px",
                  borderRadius: 8,
                }}
              >
                Upozornenia nebránia uzavretiu, no sporné a nedoručené jednotky budú v zápisnici uvedené samostatne.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {questions.map((q) => {
                const toneMap = {
                  approved: "success",
                  rejected: "danger",
                  short: "accent",
                };
                const labelMap = {
                  approved: "Schválené",
                  rejected: "Neschválené",
                  short: "Nedosiahnutá väčšina",
                };
                const iconMap = {
                  approved: "checkCircle",
                  rejected: "xCircle",
                  short: "clock",
                };
                return (
                  <div key={q.no} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-faint)" }}>{q.no}.</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{q.title}</span>
                    <span style={{ fontSize: 12, color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums" }}>
                      {q.agree} / {q.need}
                    </span>
                    <Pill tone={toneMap[q.status] as any} size="sm" icon={iconMap[q.status]}>
                      {labelMap[q.status]}
                    </Pill>
                  </div>
                );
              })}
              <div
                style={{
                  fontSize: "12.5px",
                  color: "var(--ink-soft)",
                  lineHeight: 1.5,
                  background: "var(--paper-2)",
                  padding: "10px 12px",
                  borderRadius: 8,
                  marginTop: 6,
                }}
              >
                Po potvrdení sa vygeneruje finálna PDF zápisnica a zálohuje sa na Google Drive. Výsledky sa vlastníkom <strong>neodošlú automaticky</strong> — po úspešnom zálohovaní ich odošlete tlačidlom „Odoslať vlastníkom" v záložke Zápisnica. Archív je nemenný — prípadná oprava sa rieši dodatkom.
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "16px 26px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Btn kind="secondary" onClick={onClose} disabled={loading}>
            Zrušiť
          </Btn>
          {step === 0 ? (
            <Btn kind="gold" icon="lock" onClick={() => setStep(1)} disabled={loading}>
              Uzavrieť a vyhodnotiť
            </Btn>
          ) : (
            <Btn kind="primary" icon="lock" onClick={handleClosePoll} disabled={loading}>
              {loading ? "Uzatváram..." : "Potvrdiť a uzavrieť hlasovanie"}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
};
