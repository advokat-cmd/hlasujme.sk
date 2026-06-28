"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Ic } from "../ui/Icons";
import { Card } from "../ui/Card";
import { Btn } from "../ui/Button";
import { Pill } from "../ui/Pill";
import { PageHead } from "./PageHead";
import { Modal } from "../ui/Modal";
import { FormRow, Input } from "../ui/FormControls";

interface Template {
  id: string;
  title: string;
  text: string;
  majorityType: string;
  note: string;
}

interface SettingsViewProps {
  templates: Template[];
}

const MAJORITY_LABELS: Record<string, string> = {
  "half-all": "Nadpolovičná väčšina všetkých vlastníkov (Zákonná)",
  "half_all": "Nadpolovičná väčšina všetkých vlastníkov (Zákonná)",
  "twothirds-all": "Dvojtretinová väčšina všetkých vlastníkov (Úvery, zásahy)",
  "twothirds_all": "Dvojtretinová väčšina všetkých vlastníkov (Úvery, zásahy)",
  "fourfifths-all": "Štvorpätinová väčšina všetkých vlastníkov",
  "fourfifths_all": "Štvorpätinová väčšina všetkých vlastníkov",
  "all": "Súhlas všetkých vlastníkov",
  "half-present": "Nadpolovičná väčšina zúčastnených",
  "half_present": "Nadpolovičná väčšina zúčastnených",
};

export const SettingsView: React.FC<SettingsViewProps> = ({ templates }) => {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [majorityType, setMajorityType] = useState("half-all");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleOpenAdd = () => {
    setTitle("");
    setText("");
    setMajorityType("half-all");
    setNote("");
    setError("");
    setEditingTemplate(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (t: Template) => {
    setTitle(t.title);
    setText(t.text);
    setMajorityType(t.majorityType);
    setNote(t.note);
    setError("");
    setEditingTemplate(t);
    setModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Naozaj chcete vymazať šablónu: "${name}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/templates/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert("Chyba pri mazaní šablóny.");
      }
    } catch (err) {
      alert("Chyba sieťového pripojenia.");
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !text.trim() || !majorityType) {
      setError("Názov, text a väčšina sú povinné.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const url = editingTemplate ? `/api/admin/templates/${editingTemplate.id}` : "/api/admin/templates";
      const method = editingTemplate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          text: text.trim(),
          majorityType,
          note: note.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Uloženie šablóny zlyhalo.");
      } else {
        setModalOpen(false);
        router.refresh();
      }
    } catch (err) {
      setError("Chyba sieťového pripojenia.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page-container">
      <PageHead eyebrow="Správa systému" title="Nastavenia šablón otázok">
        <Btn kind="primary" icon="plus" onClick={handleOpenAdd}>
          Pridať šablónu
        </Btn>
      </PageHead>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 10 }}>
        {templates.length > 0 ? (
          templates.map((t) => (
            <Card key={t.id} pad={20}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 9,
                    background: "var(--primary-bg)",
                    color: "var(--primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Ic name="doc" size={18} />
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "var(--ink)" }}>{t.title}</h3>
                    <Pill tone="primary" size="sm">
                      {MAJORITY_LABELS[t.majorityType] || t.majorityType}
                    </Pill>
                  </div>
                  
                  <p style={{ margin: "0 0 10px", fontSize: "13.5px", color: "var(--ink-soft)", lineHeight: 1.5 }}>
                    <strong>Návrh uznesenia:</strong> {t.text}
                  </p>

                  {t.note && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--ink-soft)",
                        background: "var(--paper-2)",
                        border: "1px solid var(--line)",
                        padding: "8px 12px",
                        borderRadius: 7,
                        lineHeight: 1.45,
                      }}
                    >
                      💡 <strong>Právny odkaz:</strong> {t.note}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <Btn kind="secondary" size="sm" icon="edit" onClick={() => handleOpenEdit(t)}>
                    Upraviť
                  </Btn>
                  <Btn kind="ghost" size="sm" icon="x" style={{ color: "var(--disagree)" }} onClick={() => handleDelete(t.id, t.title)}>
                    Zmazať
                  </Btn>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ width: 50, height: 50, borderRadius: 25, background: "var(--paper-2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 15px" }}>
              <Ic name="folder" size={24} style={{ color: "var(--ink-soft)" }} />
            </div>
            <h3 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: "0 0 6px" }}>Žiadne šablóny otázok</h3>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>Pridajte novú šablónu pomocou tlačidla vyššie.</p>
          </Card>
        )}
      </div>

      {modalOpen && (
        <Modal
          title={editingTemplate ? "Upraviť šablónu otázky" : "Pridať šablónu otázky"}
          subtitle="Vytvorte vzor otázky, ktorý sa automaticky vyplní pri tvorbe nového hlasovania."
          icon="doc"
          width={550}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <Btn kind="secondary" onClick={() => setModalOpen(false)} disabled={loading}>
                Zrušiť
              </Btn>
              <Btn kind="primary" icon="check" onClick={handleSubmit} disabled={loading}>
                {loading ? "Ukladám..." : "Uložiť šablónu"}
              </Btn>
            </>
          }
        >
          {error && (
            <div style={{ color: "var(--disagree)", display: "flex", alignItems: "center", gap: 6, fontSize: "13px", marginBottom: 15 }}>
              <Ic name="alert" size={16} />
              {error}
            </div>
          )}

          <FormRow label="Názov / Predmet" hint="Napr. Výmena stúpačiek, Zateplenie strechy a pod.">
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError("");
              }}
              placeholder="Predmet šablóny"
              required
            />
          </FormRow>

          <FormRow label="Úplné znenie návrhu uznesenia" hint="Presný text, o ktorom budú vlastníci hlasovať.">
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
                minHeight: 110,
                resize: "vertical",
                lineHeight: 1.5,
              }}
              placeholder="Súhlasíte s..."
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError("");
              }}
              required
            />
          </FormRow>

          <FormRow label="Požadovaná zákonná väčšina">
            <select
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "9px 12px",
                borderRadius: 9,
                border: "1px solid var(--line)",
                fontFamily: "inherit",
                fontSize: "13.5px",
                background: "var(--paper)",
                color: "var(--ink)",
              }}
              value={majorityType}
              onChange={(e) => setMajorityType(e.target.value)}
            >
              <option value="half-all">Nadpolovičná väčšina všetkých vlastníkov (Zákonná pre bežnú údržbu)</option>
              <option value="twothirds-all">Dvojtretinová väčšina všetkých vlastníkov (Úvery, zmluvy o vstavbe, modernizácia)</option>
              <option value="fourfifths-all">Štvorpätinová väčšina všetkých vlastníkov (Napr. zmena zmluvy o spoločenstve)</option>
              <option value="all">Súhlas všetkých vlastníkov (Napr. zmena podielov, prevod vlastníctva)</option>
              <option value="half-present">Nadpolovičná väčšina zúčastnených (Po hodine čakania na schôdzi)</option>
            </select>
          </FormRow>

          <FormRow label="Právna poznámka / Odkaz na zákon (nepovinné)" hint="Napr. citácia príslušného paragrafu zákona 182/1993 Z.z.">
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
                minHeight: 70,
                resize: "vertical",
                lineHeight: 1.5,
              }}
              placeholder="Podľa § 14b ods..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </FormRow>
        </Modal>
      )}
    </div>
  );
};
