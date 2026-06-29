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

interface EmailTemplate {
  key: string;
  subject: string;
  body: string;
}

interface SettingsViewProps {
  templates: Template[];
  emailTemplates: EmailTemplate[];
}

// Helper to convert HTML to plain text without tags
const convertHtmlToPlainText = (html: string): string => {
  if (!html) return "";
  
  let text = html.replace(/\r/g, "");

  // Remove the outermost div styles if they wrap the entire template
  text = text.replace(/<div style="font-family:[^>]+>([\s\S]*?)<\/div>/i, "$1");

  text = text
    // Replace headings (h2)
    .replace(/<h2>(.*?)<\/h2>/gi, "$1\n\n")
    // Replace subheadings (h3)
    .replace(/<h3>(.*?)<\/h3>/gi, "$1\n")
    // Replace warning blocks
    .replace(/<p class="warn">([\s\S]*?)<\/p>/gi, "$1\n\n")
    // Replace note blocks
    .replace(/<p class="note">([\s\S]*?)<\/p>/gi, "$1\n\n")
    // Replace list tags
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, "$1")
    // Replace meta credentials elements inside the boxes
    .replace(/<p class="meta"><strong>(.*?):<\/strong>\s*<a href="[^"]+">(.*?)<\/a><\/p>/gi, "$1: $2\n")
    .replace(/<p class="meta"><strong>(.*?):<\/strong>\s*<code class="pass">(.*?)<\/code><\/p>/gi, "$1: $2\n")
    .replace(/<p class="meta"><strong>(.*?):<\/strong>\s*(.*?)<\/p>/gi, "$1: $2\n")
    // Replace standard paragraphs
    .replace(/<p>([\s\S]*?)<\/p>/gi, "$1\n\n")
    // Replace box divs
    .replace(/<div class="box">([\s\S]*?)<\/div>/gi, "$1\n\n")
    .replace(/<div style="background:[^>]+>([\s\S]*?)<\/div>/gi, "$1\n\n")
    // Replace button block
    .replace(/<div style="text-align:\s*center;[^>]+>\s*<a class="btn" href="[^"]+">(.*?)<\/a>\s*<\/div>/gi, "$1\n\n")
    .replace(/<div style="text-align:\s*center;[^>]+>\s*<span[^>]+>(.*?)<\/span>\s*<\/div>/gi, "$1\n\n")
    .replace(/<a class="btn" href="[^"]+">(.*?)<\/a>/gi, "$1\n\n")
    // Clean up br
    .replace(/<br\s*\/?>/gi, "\n")
    // Strip other remaining HTML tags
    .replace(/<[^>]+>/g, "")
    .trim();

  // Normalize multiple empty lines to maximum 2 newlines
  text = text.replace(/\n{3,}/g, "\n\n");
  return text;
};

// Helper to convert plain text back to structured HTML
const convertPlainTextToHtml = (key: string, text: string): string => {
  if (!text) return "";
  
  const paragraphs = text
    .replace(/\r/g, "")
    .trim()
    .split(/\n\n+/);
    
  let html = "";
  
  paragraphs.forEach((p, idx) => {
    p = p.trim();
    if (!p) return;
    
    // Paragraph 1: h2 heading
    if (idx === 0) {
      html += `<h2>${p}</h2>\n`;
      return;
    }
    
    // Check for button text
    if (p === "👉 HLASOVAŤ ELEKTRONICKY") {
      html += `<div style="text-align: center; margin: 25px 0;">\n  <a class="btn" href="{magicLink}">👉 HLASOVAŤ ELEKTRONICKY</a>\n</div>\n`;
      return;
    }
    if (p === "Stiahnuť zápisnicu (PDF)") {
      html += `<div style="text-align: center; margin: 25px 0;">\n  <a class="btn" href="{protocolLink}">Stiahnuť zápisnicu (PDF)</a>\n</div>\n`;
      return;
    }
    
    // Check for credentials box
    if (p.includes("Prihlasovacia stránka:") || p.includes("Prihlasovací e-mail:") || p.includes("Prihlasovacie heslo:")) {
      let lines = p.split("\n").map(l => l.trim()).filter(Boolean);
      let boxHtml = `<div class="box">\n`;
      lines.forEach(line => {
        if (line.startsWith("Prihlasovacia stránka:")) {
          boxHtml += `  <p class="meta"><strong>Prihlasovacia stránka:</strong> <a href="{loginLink}">{loginLink}</a></p>\n`;
        } else if (line.startsWith("Prihlasovací e-mail:")) {
          boxHtml += `  <p class="meta"><strong>Prihlasovací e-mail:</strong> {loginEmail}</p>\n`;
        } else if (line.startsWith("Prihlasovacie heslo:")) {
          boxHtml += `  <p class="meta"><strong>Prihlasovacie heslo:</strong> <code class="pass">{rawPassword}</code></p>\n`;
        } else {
          const colonIdx = line.indexOf(":");
          if (colonIdx !== -1) {
            const label = line.substring(0, colonIdx).trim();
            const val = line.substring(colonIdx + 1).trim();
            boxHtml += `  <p class="meta"><strong>${label}:</strong> ${val}</p>\n`;
          } else {
            boxHtml += `  <p class="meta">${line}</p>\n`;
          }
        }
      });
      boxHtml += `</div>\n`;
      html += boxHtml;
      return;
    }
    
    // Check for other info box (containing {pollTitle})
    if (p.includes("{pollTitle}")) {
      let lines = p.split("\n").map(l => l.trim()).filter(Boolean);
      let boxHtml = `<div class="box">\n`;
      lines.forEach((line, lineIdx) => {
        if (lineIdx === 0) {
          boxHtml += `  <h3>${line}</h3>\n`;
        } else if (line === "{answersList}") {
          boxHtml += `  <ul style="padding-left: 20px; margin: 0; font-size: 13.5px; line-height: 1.5; color: #5C6473;">\n    {answersList}\n  </ul>\n`;
        } else {
          const colonIdx = line.indexOf(":");
          if (colonIdx !== -1) {
            const label = line.substring(0, colonIdx).trim();
            const val = line.substring(colonIdx + 1).trim();
            boxHtml += `  <p class="meta"><strong>${label}:</strong> ${val}</p>\n`;
          } else {
            boxHtml += `  <p class="meta">${line}</p>\n`;
          }
        }
      });
      boxHtml += `</div>\n`;
      html += boxHtml;
      return;
    }
    
    // Warn paragraph
    if (p.startsWith("⚠️")) {
      html += `<p class="warn">${p}</p>\n`;
      return;
    }
    
    // Note paragraph
    if (p.toLowerCase().includes("tento e-mail bol odoslaný automaticky")) {
      html += `<p class="note">${p}</p>\n`;
      return;
    }
    
    // Standard paragraph
    const content = p.replace(/\n/g, "<br/>\n");
    html += `<p>${content}</p>\n`;
  });
  
  return html.trim();
};

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

export const SettingsView: React.FC<SettingsViewProps> = ({ templates, emailTemplates }) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"questions" | "emails">("questions");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [majorityType, setMajorityType] = useState("half-all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Email template edit states
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState<EmailTemplate | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (placeholder: string) => {
    navigator.clipboard.writeText(placeholder);
    setCopiedKey(placeholder);
    setTimeout(() => {
      setCopiedKey(null);
    }, 1500);
  };

  const handleEmailSubmit = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      setEmailError("Predmet a telo e-mailu sú povinné.");
      return;
    }

    setEmailLoading(true);
    setEmailError("");

    try {
      const convertedBody = convertPlainTextToHtml(editingEmail?.key || "", emailBody);
      const res = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: editingEmail?.key,
          subject: emailSubject.trim(),
          body: convertedBody,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEmailError(data.error || "Uloženie šablóny e-mailu zlyhalo.");
      } else {
        setEmailModalOpen(false);
        router.refresh();
      }
    } catch (err) {
      setEmailError("Chyba sieťového pripojenia.");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleOpenEditEmail = (et: EmailTemplate) => {
    setEditingEmail(et);
    setEmailSubject(et.subject);
    setEmailBody(convertHtmlToPlainText(et.body));
    setEmailError("");
    setEmailModalOpen(true);
  };

  const handleOpenAdd = () => {
    setTitle("");
    setText("");
    setMajorityType("half-all");
    setError("");
    setEditingTemplate(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (t: Template) => {
    setTitle(t.title);
    setText(t.text);
    setMajorityType(t.majorityType);
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
          note: null,
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
      <PageHead eyebrow="Správa systému" title="Nastavenia systému" />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--line)", paddingBottom: 0, marginBottom: 20, marginTop: 10 }}>
        <button
          onClick={() => setActiveTab("questions")}
          style={{
            background: "none",
            border: "none",
            fontSize: "14.5px",
            fontWeight: 600,
            color: activeTab === "questions" ? "var(--primary)" : "var(--ink-soft)",
            borderBottom: activeTab === "questions" ? "3px solid var(--primary)" : "3px solid transparent",
            padding: "10px 16px",
            cursor: "pointer",
            marginBottom: -2,
            transition: "all 0.15s"
          }}
        >
          Šablóny otázok
        </button>
        <button
          onClick={() => setActiveTab("emails")}
          style={{
            background: "none",
            border: "none",
            fontSize: "14.5px",
            fontWeight: 600,
            color: activeTab === "emails" ? "var(--primary)" : "var(--ink-soft)",
            borderBottom: activeTab === "emails" ? "3px solid var(--primary)" : "3px solid transparent",
            padding: "10px 16px",
            cursor: "pointer",
            marginBottom: -2,
            transition: "all 0.15s"
          }}
        >
          E-mailové šablóny
        </button>
      </div>

      {activeTab === "questions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {templates.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
              <Btn kind="primary" icon="plus" onClick={handleOpenAdd}>
                Pridať šablónu otázky
              </Btn>
            </div>
          )}

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
            <Card style={{ padding: "45px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 50, height: 50, borderRadius: 25, background: "var(--paper-2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 15 }}>
                <Ic name="folder" size={24} style={{ color: "var(--ink-soft)" }} />
              </div>
              <h3 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: "0 0 6px" }}>Žiadne šablóny otázok</h3>
              <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 20 }}>Uľahčite si zadávanie otázok vytvorením vlastných šablón.</p>
              <Btn kind="primary" icon="plus" onClick={handleOpenAdd}>
                Pridať šablónu otázky
              </Btn>
            </Card>
          )}
        </div>
      )}

      {activeTab === "emails" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {emailTemplates && emailTemplates.length > 0 ? (
            emailTemplates.map((et) => (
              <Card key={et.key} pad={20}>
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
                    <Ic name="mail" size={18} />
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "var(--ink)" }}>
                        {et.key === "invitation" 
                          ? "Pozvánka na hlasovanie (Magic Link)" 
                          : et.key === "protocol" 
                          ? "Výsledok hlasovania (Zápisnica)" 
                          : et.key === "credentials" 
                          ? "Prístupové údaje pre vlastníka" 
                          : et.key === "reminder"
                          ? "Pripomienka (48 h pred koncom)"
                          : et.key === "confirmation"
                          ? "Potvrdenie prijatia hlasu"
                          : et.key}
                      </h3>
                    </div>
                    
                    <p style={{ margin: "0 0 6px", fontSize: "13.5px", color: "var(--ink)", lineHeight: 1.5 }}>
                      <strong>Predmet:</strong> {et.subject}
                    </p>
                    <p style={{ margin: 0, fontSize: "12.5px", color: "var(--ink-soft)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: 650 }}>
                      <strong>Telo e-mailu:</strong> {et.body.replace(/<[^>]*>/g, '').slice(0, 120)}...
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <Btn kind="secondary" size="sm" icon="edit" onClick={() => handleOpenEditEmail(et)}>
                      Upraviť šablónu
                    </Btn>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card style={{ padding: "40px 20px", textAlign: "center" }}>
              <h3 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: "0 0 6px" }}>Žiadne e-mailové šablóny</h3>
            </Card>
          )}
        </div>
      )}

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
        </Modal>
      )}

      {emailModalOpen && editingEmail && (
        <Modal
          title="Upraviť e-mailovú šablónu"
          subtitle="Upravte predmet a telo e-mailu. Použite premenné z pravého panela."
          icon="mail"
          width={800}
          onClose={() => setEmailModalOpen(false)}
          footer={
            <>
              <Btn kind="secondary" onClick={() => setEmailModalOpen(false)} disabled={emailLoading}>
                Zrušiť
              </Btn>
              <Btn kind="primary" icon="check" onClick={handleEmailSubmit} disabled={emailLoading}>
                {emailLoading ? "Ukladám..." : "Uložiť šablónu"}
              </Btn>
            </>
          }
        >
          {emailError && (
            <div style={{ color: "var(--disagree)", display: "flex", alignItems: "center", gap: 6, fontSize: "13px", marginBottom: 15 }}>
              <Ic name="alert" size={16} />
              {emailError}
            </div>
          )}

          <div style={{ display: "flex", gap: 20 }}>
            {/* Editor form */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 15 }}>
              <FormRow label="Predmet e-mailu" hint="Môžete použiť premenné ako {pollTitle}">
                <Input
                  value={emailSubject}
                  onChange={(e) => {
                    setEmailSubject(e.target.value);
                    setEmailError("");
                  }}
                  placeholder="Zadajte predmet e-mailu"
                  required
                />
              </FormRow>

              <FormRow label="Telo e-mailu" hint="Môžete používať premenné z pravého panela.">
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
                    minHeight: 280,
                    resize: "vertical",
                    lineHeight: 1.5,
                  }}
                  placeholder="Sem napíšte text e-mailu..."
                  value={emailBody}
                  onChange={(e) => {
                    setEmailBody(e.target.value);
                    setEmailError("");
                  }}
                  required
                />
              </FormRow>
            </div>

            {/* Sidebar with copyable variables */}
            <div
              style={{
                width: 250,
                borderLeft: "1px solid var(--line)",
                paddingLeft: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 4px", color: "var(--ink-soft)" }}>
                Premenné šablóny
              </h4>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(editingEmail.key === "invitation" ? [
                  { name: "{ownerName}", desc: "Meno a priezvisko vlastníka" },
                  { name: "{buildingName}", desc: "Názov bytového domu" },
                  { name: "{pollTitle}", desc: "Názov hlasovania" },
                  { name: "{pollReason}", desc: "Dôvod vyhlásenia" },
                  { name: "{endFormatted}", desc: "Dátum a čas uzávierky" },
                  { name: "{magicLink}", desc: "Bezpečný odkaz na hlasovanie" },
                ] : editingEmail.key === "reminder" ? [
                  { name: "{ownerName}", desc: "Meno a priezvisko vlastníka" },
                  { name: "{buildingName}", desc: "Názov bytového domu" },
                  { name: "{pollTitle}", desc: "Názov hlasovania" },
                  { name: "{endFormatted}", desc: "Dátum a čas uzávierky" },
                  { name: "{magicLink}", desc: "Bezpečný odkaz na hlasovanie" },
                ] : editingEmail.key === "confirmation" ? [
                  { name: "{ownerName}", desc: "Meno a priezvisko vlastníka" },
                  { name: "{unitNo}", desc: "Číslo bytu" },
                  { name: "{pollTitle}", desc: "Názov hlasovania" },
                  { name: "{dateFormatted}", desc: "Dátum a čas odovzdania" },
                  { name: "{answersList}", desc: "Zoznam zaznamenaných odpovedí" },
                ] : editingEmail.key === "protocol" ? [
                  { name: "{ownerName}", desc: "Meno a priezvisko vlastníka" },
                  { name: "{buildingName}", desc: "Názov bytového domu" },
                  { name: "{pollTitle}", desc: "Názov hlasovania" },
                  { name: "{protocolLink}", desc: "Odkaz na zápisnicu PDF (nevyžaduje prihlásenie)" },
                ] : [
                  { name: "{ownerName}", desc: "Meno a priezvisko vlastníka" },
                  { name: "{buildingName}", desc: "Názov bytového domu" },
                  { name: "{buildingShort}", desc: "Skrátený názov bytového domu" },
                  { name: "{loginLink}", desc: "Odkaz na prihlasovaciu stránku" },
                  { name: "{loginEmail}", desc: "Prihlasovací e-mail vlastníka" },
                  { name: "{rawPassword}", desc: "Generované heslo vlastníka" },
                ]).map((v) => {
                  const copied = copiedKey === v.name;
                  return (
                    <div
                      key={v.name}
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        background: "var(--paper-2)",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 6,
                          marginBottom: 4,
                        }}
                      >
                        <code style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)", fontFamily: "monospace" }}>
                          {v.name}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopy(v.name)}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 6px",
                            borderRadius: 4,
                            cursor: "pointer",
                            background: copied ? "var(--agree)" : "var(--primary)",
                            color: "#fff",
                            border: "none",
                            display: "flex",
                            alignItems: "center",
                            gap: 3,
                            transition: "all 0.15s",
                          }}
                        >
                          {copied ? "Kopírované" : "Kopírovať"}
                        </button>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{v.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
