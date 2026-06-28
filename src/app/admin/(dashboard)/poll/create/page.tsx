"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ic } from "@/components/ui/Icons";
import { Btn } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Stat } from "@/components/ui/Stat";
import { PageHead } from "@/components/admin/PageHead";
import { FormRow, Input } from "@/components/ui/FormControls";
import { useNarrow } from "@/components/ui/LayoutHelpers";

// Default Slovakia date-time formatting helpers
function tomorrowAt(h: number, m = 0, addDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + 1 + addDays);
  d.setHours(h, m, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtDT(v: string) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const MAJORITY_OPTS = {
  "half-all": { label: "Nadpolovičná väčšina všetkých vlastníkov", frac: "> 1/2 všetkých" },
  "twothirds-all": { label: "Dvojtretinová väčšina všetkých vlastníkov", frac: "≥ 2/3 všetkých" },
  "fourfifths-all": { label: "Štvorpätinová väčšina všetkých vlastníkov", frac: "≥ 4/5 všetkých" },
  all: { label: "Súhlas všetkých vlastníkov", frac: "všetci" },
  "half-present": { label: "Nadpolovičná väčšina zúčastnených", frac: "> 1/2 hlasujúcich" },
};



const fieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 13px",
  borderRadius: 9,
  border: "1px solid var(--line)",
  fontFamily: "inherit",
  fontSize: "14px",
  background: "var(--paper)",
  color: "var(--ink)",
};

export default function CreatePollPage() {
  const router = useRouter();
  const isMobile = useNarrow(600);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect owners/vlastníci if they try to access this page
  React.useEffect(() => {
    fetch("/api/admin/building", { method: "POST", body: JSON.stringify({}) })
      .then((res) => {
        if (res.status === 403) {
          router.push("/admin");
        }
      });
  }, [router]);

  const steps = ["Základné údaje", "Otázky a väčšina", "Oprávnené jednotky", "Kontrola a spustenie"];
  
  const [templatesList, setTemplatesList] = useState<any[]>([]);

  // Fetch templates from database
  React.useEffect(() => {
    fetch("/api/admin/templates")
      .then((res) => res.json())
      .then((data) => {
        if (data.templates) {
          setTemplatesList(data.templates);
        }
      })
      .catch((err) => console.error("Failed to load templates:", err));
  }, []);
  
  const [basics, setBasics] = useState({
    title: "",
    reason: "",
    start: tomorrowAt(8),
    end: tomorrowAt(20, 0, 14),
  });

  const [questions, setQuestions] = useState<Array<{ id: number; text: string; majority: string; note: string; file?: File }>>([
    { id: 1, text: "", majority: "half-all", note: "" },
  ]);

  const [tmplFor, setTmplFor] = useState<number | null>(null);

  const setBasicsVal = (k: string, v: string) => setBasics((b) => ({ ...b, [k]: v }));
  
  const addQ = () =>
    setQuestions((qs) => [...qs, { id: Date.now(), text: "", majority: "half-all", note: "" }]);
    
  const rmQ = (id: number) =>
    setQuestions((qs) => (qs.length > 1 ? qs.filter((q) => q.id !== id) : qs));
    
  const setQVal = (id: number, patch: any) =>
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const handleLaunch = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basics,
          questions: questions.map((q) => ({
            text: q.text,
            majority: q.majority,
            note: q.note || "",
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Nepodarilo sa vytvoriť hlasovanie.");
        setLoading(false);
      } else {
        const pollId = data.pollId;
        // Upload question-specific attachments if any
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          if (q.file) {
            try {
              const formData = new FormData();
              formData.append("file", q.file);

              const uploadRes = await fetch(`/api/admin/poll/${pollId}/upload`, {
                method: "POST",
                body: formData,
              });

              if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                const webViewLink = uploadData.file.webViewLink;

                await fetch(`/api/admin/poll/${pollId}/question/${i + 1}/attach`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ attachmentUrl: webViewLink }),
                });
              }
            } catch (uploadErr) {
              console.error(`Failed to upload attachment for question ${i + 1}:`, uploadErr);
            }
          }
        }

        router.push(`/admin/poll/${pollId}`);
        router.refresh();
      }
    } catch (err) {
      setError("Chyba sieťového pripojenia.");
      setLoading(false);
    }
  };

  const validateStep = () => {
    if (step === 0) {
      if (!basics.title.trim() || !basics.reason.trim()) {
        alert("Prosím, vyplňte názov a dôvod hlasovania.");
        return;
      }
    }
    if (step === 1) {
      if (questions.some((q) => !q.text.trim())) {
        alert("Prosím, vyplňte znenie všetkých otázok.");
        return;
      }
    }
    setStep(step + 1);
  };

  return (
    <div className="admin-page-container">
      <PageHead eyebrow="Nové elektronické hlasovanie" title="Vytvoriť hlasovanie">
        <Link href="/admin" style={{ textDecoration: "none" }}>
          <Btn kind="ghost">Zrušiť</Btn>
        </Link>
      </PageHead>

      {/* Stepper */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 30, userSelect: "none" }}>
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "var(--serif)",
                  background: i < step ? "var(--agree)" : i === step ? "var(--primary)" : "var(--paper-2)",
                  color: i <= step ? "#fff" : "var(--ink-faint)",
                  border: i > step ? "1px solid var(--line)" : "none",
                }}
              >
                {i < step ? <Ic name="check" size={15} sw={3} /> : i + 1}
              </div>
              {(!isMobile || i === step) && (
                <span style={{ fontSize: 13, fontWeight: 600, color: i <= step ? "var(--ink)" : "var(--ink-faint)", whiteSpace: "nowrap" }}>
                  {s}
                </span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 1.5, margin: "0 14px", background: i < step ? "var(--agree)" : "var(--line)" }} />
            )}
          </React.Fragment>
        ))}
      </div>

      <Card style={{ marginBottom: 22 }}>
        {error && (
          <div style={{ color: "var(--disagree)", display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, marginBottom: 15 }}>
            <Ic name="alert" size={17} />
            {error}
          </div>
        )}

        {step === 0 && (
          <div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 19, fontWeight: 600, color: "var(--ink)", marginBottom: 16 }}>
              Základné údaje hlasovania
              <div style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 500, marginTop: 2 }}>
                Tieto údaje sa objavia v pozvánke aj v zápisnici
              </div>
            </div>
            
            <FormRow label="Názov hlasovania">
              <input
                style={fieldStyle}
                placeholder="napr. Hlasovanie vlastníkov – jar 2026"
                value={basics.title}
                onChange={(e) => setBasicsVal("title", e.target.value)}
                required
              />
            </FormRow>
            
            <FormRow label="Dôvod hlasovania">
              <input
                style={fieldStyle}
                placeholder="napr. Obnova vstupných priestorov a financovanie opráv"
                value={basics.reason}
                onChange={(e) => setBasicsVal("reason", e.target.value)}
                required
              />
            </FormRow>
            
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
              <FormRow label="Začiatok hlasovania" hint="Predvolene zajtrajší deň — kliknutím zvolíte dátum a čas.">
                <input
                  type="datetime-local"
                  style={fieldStyle}
                  value={basics.start}
                  onChange={(e) => setBasicsVal("start", e.target.value)}
                />
              </FormRow>
              <FormRow label="Koniec hlasovania" hint="Do tohto termínu môžu vlastníci hlas meniť.">
                <input
                  type="datetime-local"
                  style={fieldStyle}
                  value={basics.end}
                  onChange={(e) => setBasicsVal("end", e.target.value)}
                />
              </FormRow>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontFamily: "var(--serif)", fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>Otázky</div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 2 }}>
                  Pri každej otázke nastavte požadovanú väčšinu podľa zákona č. 182/1993 Z. z.
                </div>
              </div>
              <Btn kind="secondary" size="sm" icon="plus" onClick={addQ}>
                Pridať otázku
              </Btn>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {questions.map((q, idx) => (
                <div key={q.id} style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "11px 16px",
                      background: "var(--paper-2)",
                      borderBottom: "1px solid var(--line)",
                    }}
                  >
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 7,
                        background: "var(--primary)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12.5,
                        fontWeight: 700,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Otázka č. {idx + 1}</span>
                    
                    <button
                      onClick={() => setTmplFor(tmplFor === q.id ? null : q.id)}
                      style={{
                        marginLeft: "auto",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--primary)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Ic name="doc" size={14} /> Šablóny
                    </button>
                    {questions.length > 1 && (
                      <button
                        onClick={() => rmQ(q.id)}
                        aria-label={`Odstrániť otázku č. ${idx + 1}`}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-faint)", display: "flex" }}
                      >
                        <Ic name="x" size={17} />
                      </button>
                    )}
                  </div>
                  
                  {tmplFor === q.id && (
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink-soft)" }}>Zvoľte šablónu pre automatické vyplnenie:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                        {templatesList.length > 0 ? (
                          templatesList.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => {
                                setQVal(q.id, {
                                  text: t.text,
                                  majority: t.majorityType,
                                  note: t.note || ""
                                });
                                setTmplFor(null);
                              }}
                              style={{
                                fontSize: 12,
                                padding: "6px 12px",
                                borderRadius: 12,
                                border: "1px solid var(--line)",
                                background: "var(--surface)",
                                cursor: "pointer",
                                color: "var(--ink-soft)",
                                fontFamily: "inherit",
                                textAlign: "left"
                              }}
                            >
                              <strong>{t.title}</strong>
                            </button>
                          ))
                        ) : (
                          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                            Žiadne šablóny nie sú k dispozícii.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ padding: 16 }}>
                    <FormRow label="Úplné znenie návrhu">
                      <textarea
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "10px 13px",
                          borderRadius: 9,
                          border: "1px solid var(--line)",
                          fontFamily: "inherit",
                          fontSize: "14px",
                          background: "var(--paper)",
                          color: "var(--ink)",
                          minHeight: 72,
                          resize: "vertical",
                          lineHeight: 1.5,
                        }}
                        placeholder="Súhlasíte s…?"
                        value={q.text}
                        onChange={(e) => setQVal(q.id, { text: e.target.value })}
                        required
                      />
                    </FormRow>
                    
                    <FormRow label="Požadovaná väčšina">
                      <div role="radiogroup" aria-label="Požadovaná väčšina" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                        {Object.entries(MAJORITY_OPTS).map(([k, m]) => (
                          <button
                            key={k}
                            role="radio"
                            aria-checked={q.majority === k}
                            onClick={() => setQVal(q.id, { majority: k })}
                            style={{
                              textAlign: "left",
                              padding: "10px 12px",
                              borderRadius: 9,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              border: "1.5px solid",
                              borderColor: q.majority === k ? "var(--primary)" : "var(--line)",
                              background: q.majority === k ? "var(--primary-bg)" : "var(--surface)",
                            }}
                          >
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: q.majority === k ? "var(--primary)" : "var(--ink)" }}>
                              {m.label}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 1 }}>{m.frac}</div>
                          </button>
                        ))}
                      </div>
                    </FormRow>
                    
                    <FormRow label="Poznámka / Odkaz na zákon (nepovinné)" hint="Napr. citácia znenia zákona o vlastníctve bytov.">
                      <textarea
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "10px 13px",
                          borderRadius: 9,
                          border: "1px solid var(--line)",
                          fontFamily: "inherit",
                          fontSize: "13.5px",
                          background: "var(--paper)",
                          color: "var(--ink)",
                          minHeight: 56,
                          resize: "vertical",
                          lineHeight: 1.5,
                        }}
                        placeholder="Podľa § 14b..."
                        value={q.note || ""}
                        onChange={(e) => setQVal(q.id, { note: e.target.value })}
                      />
                    </FormRow>

                    <FormRow label="Podkladový dokument k otázke (nepovinné)" hint="Súbor bude nahraný na Google Drive a sprístupnený vlastníkom pri hlasovaní.">
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input
                          type="file"
                          id={`file-upload-${q.id}`}
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const selectedFile = e.target.files?.[0];
                            if (selectedFile) {
                              setQVal(q.id, { file: selectedFile });
                            }
                          }}
                        />
                        <label
                          htmlFor={`file-upload-${q.id}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 14px",
                            borderRadius: 9,
                            border: "1px dashed var(--line)",
                            background: "var(--surface)",
                            cursor: "pointer",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "var(--primary)",
                          }}
                        >
                          <Ic name="upload" size={15} />
                          {q.file ? "Zmeniť dokument" : "Vybrať dokument"}
                        </label>
                        {q.file && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12.5px", color: "var(--ink-soft)" }}>
                            <Ic name="doc" size={14} style={{ color: "var(--primary)" }} />
                            <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {q.file.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => setQVal(q.id, { file: undefined })}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "var(--disagree)",
                                display: "inline-flex",
                                padding: 2,
                              }}
                            >
                              <Ic name="x" size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </FormRow>
                    
                    <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: "12.5px", color: "var(--ink-soft)", flexWrap: "wrap", marginTop: 14 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>Možnosti odpovede:</span>
                      <Pill tone="agree" size="sm" icon="check">
                        Súhlasím
                      </Pill>
                      <Pill tone="disagree" size="sm" icon="x">
                        Nesúhlasím
                      </Pill>
                      <Pill tone="abstain" size="sm" icon="minus">
                        Nechcem hlasovať
                      </Pill>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 19, fontWeight: 600, color: "var(--ink)", marginBottom: 16 }}>
              Oprávnené jednotky
              <div style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 500, marginTop: 2 }}>
                Predvolene sú zahrnuté všetky aktívne jednotky domu.
              </div>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 12, marginBottom: 18 }}>
              <Card pad={16}>
                <Stat label="Zahrnuté jednotky" value="36 / 36" />
              </Card>
              <Card pad={16}>
                <Stat label="So spoluvlastníkmi" value="5" sub="rieši sa podľa režimu" />
              </Card>
              <Card pad={16}>
                <Stat label="Bez e-mailu" value="1" tone="var(--disagree)" sub="byt č. 8" />
              </Card>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { title: "Jediný vlastník / BSM", desc: "Link dostane určená osoba", count: "30 jednotiek" },
                { title: "Určený zástupca bytu", desc: "Link iba zástupcovi, ostatní info kópiu", count: "1 jednotka" },
                { title: "Interné hlasovanie spoluvlastníkov", desc: "Link každému spoluvlastníkovi zvlášť", count: "2 jednotky" },
                { title: "Väčšinový spoluvlastník", desc: "Link len väčšinovému vlastníkovi podielu", count: "1 jednotka" },
              ].map((g, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", border: "1px solid var(--line)", borderRadius: 10 }}>
                  <Ic name="users" size={18} style={{ color: "var(--ink-soft)" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{g.title}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{g.desc}</div>
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)" }}>{g.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 19, fontWeight: 600, color: "var(--ink)", marginBottom: 16 }}>
              Kontrola a spustenie
              <div style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 500, marginTop: 2 }}>
                Aplikácia skontroluje úplnosť pred odoslaním
              </div>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr", gap: 22 }}>
              <div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "13.5px" }}>
                    <Ic name="checkCircle" size={18} style={{ color: "var(--agree)", flexShrink: 0, marginTop: 1 }} />
                    <span style={{ color: "var(--ink)" }}>Každá otázka má priradenú väčšinu</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "13.5px" }}>
                    <Ic name="checkCircle" size={18} style={{ color: "var(--agree)", flexShrink: 0, marginTop: 1 }} />
                    <span style={{ color: "var(--ink)" }}>Všetci vlastníci sú priradení k jednotkám</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "13.5px" }}>
                    <Ic name="checkCircle" size={18} style={{ color: "var(--agree)", flexShrink: 0, marginTop: 1 }} />
                    <span style={{ color: "var(--ink)" }}>Vyriešené režimy spoluvlastníctva</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "13.5px" }}>
                    <Ic name="alert" size={18} style={{ color: "var(--accent-ink)", flexShrink: 0, marginTop: 1 }} />
                    <span style={{ color: "var(--accent-ink)" }}>Byt č. 8 nemá nahlásenú e-mailovú adresu</span>
                  </div>
                </div>
                
                <div
                  style={{
                    marginTop: 18,
                    padding: "12px 14px",
                    borderRadius: 9,
                    background: "var(--primary-bg)",
                    fontSize: "12.5px",
                    color: "var(--primary)",
                    lineHeight: 1.5,
                    display: "flex",
                    gap: 9,
                  }}
                >
                  <Ic name="send" size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  Po spustení sa vygenerujú unikátne šifrované magic linky pre jednotky (a pre jednotlivých spoluvlastníkov
                  pri internom režime) a automaticky sa odošlú e-mailové pozvánky.
                </div>
              </div>
              
              <div style={{ background: "var(--paper-2)", borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                  Zhrnutie
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderTop: "1px solid var(--line)", fontSize: 13 }}>
                  <span style={{ color: "var(--ink-soft)" }}>Názov</span>
                  <span style={{ fontWeight: 600, textAlign: "right" }}>{basics.title || "názov nevyplnený"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderTop: "1px solid var(--line)", fontSize: 13 }}>
                  <span style={{ color: "var(--ink-soft)" }}>Trvanie</span>
                  <span style={{ fontWeight: 600, textAlign: "right" }}>
                    {fmtDT(basics.start)} → {fmtDT(basics.end)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderTop: "1px solid var(--line)", fontSize: 13 }}>
                  <span style={{ color: "var(--ink-soft)" }}>Počet otázok</span>
                  <span style={{ fontWeight: 600, textAlign: "right" }}>{questions.length}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderTop: "1px solid var(--line)", fontSize: 13 }}>
                  <span style={{ color: "var(--ink-soft)" }}>Oprávnené hlasy</span>
                  <span style={{ fontWeight: 600, textAlign: "right" }}>36 jednotiek</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderTop: "1px solid var(--line)", fontSize: 13 }}>
                  <span style={{ color: "var(--ink-soft)" }}>Odosielateľ</span>
                  <span style={{ fontWeight: 600, textAlign: "right" }}>Resend / Postmark API</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Btn kind="secondary" icon="chevL" onClick={() => (step > 0 ? setStep(step - 1) : router.push("/admin"))} disabled={loading}>
          {step > 0 ? "Späť" : "Zrušiť"}
        </Btn>
        {step < 3 ? (
          <Btn kind="primary" iconR="chevR" onClick={validateStep} disabled={loading}>
            Pokračovať
          </Btn>
        ) : (
          <Btn kind="gold" icon="send" onClick={handleLaunch} disabled={loading}>
            {loading ? "Spúšťam hlasovanie..." : "Spustiť a odoslať pozvánky"}
          </Btn>
        )}
      </div>
    </div>
  );
}
