"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ic } from "../ui/Icons";
import { Btn } from "../ui/Button";
import { Pill } from "../ui/Pill";
import { Card } from "../ui/Card";
import { Progress } from "../ui/Progress";
import { PageHead } from "./PageHead";
import { TableScroll, useNarrow } from "../ui/LayoutHelpers";
import { VOTE_STYLE } from "../ui/Pill";
import { CloseModal } from "./CloseModal";

const extractDriveFileId = (url: string): string | null => {
  if (!url) return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
};

interface ProtocolEmailLog {
  id: string;
  email: string;
  sentAt: string;
}

interface PollDetailViewProps {
  poll: {
    id: string;
    title: string;
    reason: string;
    declarer: string;
    announcedAt: string;
    startAt: string;
    endAt: string;
    status: string;
    sealedResult?: {
      pdfPath: string;
      sha256: string;
    } | null;
    protocolEmailLogs?: ProtocolEmailLog[];
  };
  questions: Array<{
    id: string;
    no: number;
    kind: string;
    title: string;
    text: string;
    majorityType: string;
    note: string | null;
    attachments: string[];
    tally: {
      total: number;
      agree: number;
      disagree: number;
      abstain: number;
      none: number;
      disputed: number;
      voted: number;
      need: number;
      status: "approved" | "rejected" | "short";
    };
  }>;
  unitVotesList: Array<{
    unitId: string;
    unitNo: string;
    ownerName: string;
    coMode: string;
    voted: boolean;
    disputed: boolean;
    at: string | null;
    changed: boolean;
    answers: Array<{
      qNo: number;
      answer: string | null;
      disputed: boolean;
      note: string | null;
    }>;
    recipients: Array<{ name: string; email: string | null; sentAt?: string | null }>;
  }>;
  emailStats: {
    eligibleEmailsCount: number;
    unvotedEmailsCount: number;
    votedCount: number;
    missingEmailsCount: number;
    missingEmailsUnits: string[];
  };
  userRole?: string;
  emailTemplates?: Array<{ key: string; subject: string; body: string }>;
}

export const PollDetailView: React.FC<PollDetailViewProps> = ({
  poll,
  questions,
  unitVotesList,
  emailStats,
  userRole,
  emailTemplates,
}) => {
  const router = useRouter();
  const isMobile = useNarrow(600);
  const [tab, setTab] = useState("results");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const queryTab = params.get("tab");
      if (queryTab && ["results", "units", "emails", "protocol", "documents"].includes(queryTab)) {
        setTab(queryTab);
      }
    }
  }, []);

  const [sendingProtocol, setSendingProtocol] = useState(false);
  const [protocolError, setProtocolError] = useState("");
  const [protocolSuccess, setProtocolSuccess] = useState("");

  const handleSendProtocolToOwners = async () => {
    setSendingProtocol(true);
    setProtocolError("");
    setProtocolSuccess("");

    try {
      const res = await fetch(`/api/admin/poll/${poll.id}/send-protocol`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        setProtocolError(data.error || "Nepodarilo sa odoslať zápisnicu.");
      } else {
        setProtocolSuccess(`Zápisnica bola úspešne odoslaná ${data.successCount} vlastníkom.`);
        router.refresh();
      }
    } catch (err) {
      setProtocolError("Chyba sieťového pripojenia.");
    } finally {
      setSendingProtocol(false);
    }
  };

  const handleDeletePoll = async () => {
    if (!confirm("Naozaj chcete natrvalo vymazať toto hlasovanie? Táto akcia vymaže všetky priradené otázky, hlasy, vygenerované prístupové kľúče a zápisnice. Táto akcia je nevratná.")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/poll/${poll.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Nepodarilo sa vymazať hlasovanie.");
      } else {
        alert("Hlasovanie bolo úspešne vymazané.");
        window.location.href = "/admin/poll/active";
      }
    } catch (err) {
      alert("Chyba pripojenia k sieti.");
    }
  };

  const handleTabChange = (newTab: string) => {
    setTab(newTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", newTab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const [closing, setClosing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [expandedEmailCard, setExpandedEmailCard] = useState<number | null>(null);

  const [files, setFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [resendingEmail, setResendingEmail] = useState<string | null>(null);

  const handleResendEmail = async (email: string, unitNo: string) => {
    if (!email) return;
    const confirmSend = confirm(`Naozaj chcete znova odoslať pozvánku na e-mail ${email}?`);
    if (!confirmSend) return;

    setResendingEmail(`${unitNo}-${email}`);
    try {
      const res = await fetch(`/api/admin/poll/${poll.id}/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, unitNo })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Pozvánka bola úspešne odoslaná na e-mail ${email}.`);
      } else {
        alert(data.error || "Odoslanie zlyhalo.");
      }
    } catch (err) {
      console.error(err);
      alert("Chyba sieťového pripojenia.");
    } finally {
      setResendingEmail(null);
    }
  };

  const fetchFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await fetch(`/api/admin/poll/${poll.id}/files`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (err) {
      console.error("Failed to fetch files:", err);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [poll.id]);

  const disputedUnitsList = unitVotesList.filter((u) => u.disputed);
  const disputedUnitsCount = disputedUnitsList.length;

  const tabs = userRole === "vlastnik"
    ? [
        { id: "results", label: "Otázky a výsledky", icon: "scale" },
        { id: "protocol", label: "Zápisnica", icon: "paper" },
        { id: "documents", label: "Podklady a dokumenty", icon: "folder" },
      ]
    : [
        { id: "results", label: "Otázky a výsledky", icon: "scale" },
        { id: "units", label: "Účasť po jednotkách", icon: "building" },
        { id: "emails", label: "Pozvánky a e-maily", icon: "mail" },
        { id: "protocol", label: "Zápisnica", icon: "paper" },
        { id: "documents", label: "Podklady a dokumenty", icon: "folder" },
      ];

  const filteredVoterRows = unitVotesList.filter((r) => {
    if (filter === "voted") return r.voted;
    if (filter === "none") return !r.voted;
    if (filter === "disputed") return r.disputed;
    return true;
  });

  const formattedEnd = new Date(poll.endAt).toLocaleString("sk-SK", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const getEmailPreview = (
    key: string,
    defaultSubject: string,
    defaultBody: React.ReactNode
  ): { subject: string; body: React.ReactNode } => {
    const template = emailTemplates?.find((t) => t.key === key);
    if (!template) {
      return { subject: defaultSubject, body: defaultBody };
    }

    const formattedSubject = template.subject
      .replace(/{pollTitle}/g, poll.title)
      .replace(/{buildingShort}/g, "Björnsonova 3");

    const answersListHtml = `
      <li style="margin-bottom: 6px;">
        <strong>Otázka 1:</strong> Schválenie rozpočtu na rok 2026 <br/>
        Odpoveď: <span style="font-weight: bold; color: var(--agree)">Súhlasím</span>
      </li>
      <li>
        <strong>Otázka 2:</strong> Voľba zástupcu vlastníkov <br/>
        Odpoveď: <span style="font-weight: bold; color: var(--disagree)">Nesúhlasím</span>
      </li>
    `;

    const bodyHtml = template.body
      .replace(/{ownerName}/g, "[Meno vlastníka]")
      .replace(/{buildingName}/g, "Björnsonova 3")
      .replace(/{buildingShort}/g, "Björnsonova 3")
      .replace(/{pollTitle}/g, poll.title)
      .replace(/{pollReason}/g, poll.reason || "Bežná údržba")
      .replace(/{endFormatted}/g, formattedEnd)
      .replace(/{magicLink}/g, "#")
      .replace(/{protocolLink}/g, "#")
      .replace(/{loginLink}/g, "#")
      .replace(/{loginEmail}/g, "vlastnik@domena.sk")
      .replace(/{rawPassword}/g, "h3S7o9xP")
      .replace(/{unitNo}/g, "[Číslo bytu]")
      .replace(/{dateFormatted}/g, "[Dátum a čas odovzdania]")
      .replace(/{answersList}/g, answersListHtml);

    const previewHtml = `
      <div style="font-family: sans-serif; color: #1B2330; border: 1px solid var(--line); border-radius: 8px; padding: 16px; background: var(--paper); font-size: 13.5px; line-height: 1.5;">
        ${bodyHtml
          .replace(/<h2>/g, '<h2 style="font-family: var(--serif); color: var(--primary); margin-top: 0; font-size: 16px; font-weight: 600; border-bottom: 1.5px solid var(--line); padding-bottom: 6px;">')
          .replace(/<\/h2>/g, '</h2>')
          .replace(/<h3>/g, '<h3 style="margin-top: 0; color: var(--primary); font-size: 14px; font-weight: 600;">')
          .replace(/<\/h3>/g, '</h3>')
          .replace(/<div class="box">/g, '<div style="background: var(--paper-2); padding: 12px 14px; border-radius: 8px; border: 1px solid var(--line); margin: 12px 0;">')
          .replace(/<a class="btn" href="([^"]+)">/g, '<span style="display: inline-block; background-color: var(--primary); color: #ffffff; padding: 8px 16px; border-radius: 6px; font-weight: bold; font-size: 11.5px; cursor: pointer;">')
          .replace(/<\/a>/g, '</span>')
          .replace(/<p class="note">/g, '<p style="font-size: 11px; color: var(--ink-soft); line-height: 1.4; margin: 8px 0 0;">')
          .replace(/<p class="meta">/g, '<p style="margin: 0 0 4px; color: var(--ink-soft); font-size: 12px; line-height: 1.4;">')
          .replace(/<p class="warn">/g, '<p style="font-size: 12px; color: #b91c1c; font-weight: 600; line-height: 1.5; background: #fee2e2; padding: 8px 10px; border-radius: 6px; margin: 12px 0;">')
          .replace(/<code class="pass">/g, '<code style="font-family: monospace; font-size: 13.5px; color: #b91c1c; font-weight: bold; background: #fee2e2; padding: 2px 4px; border-radius: 4px;">')
          .replace(/<p>/g, '<p style="font-size: 13px; line-height: 1.5; color: var(--ink); margin: 8px 0;">')}
      </div>
    `;

    return {
      subject: formattedSubject,
      body: <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
    };
  };

  const emailCards = [
    {
      t: "Pozvánka na hlasovanie",
      d: `Odoslané pri spustení — osobný link každému vlastníkovi`,
      n: emailStats.eligibleEmailsCount,
      s: "sent",
      icon: "send" as const,
      ...getEmailPreview("invitation", `Pozvánka na hlasovanie: ${poll.title}`, (
        <div>
          <p>Vážený vlastník <strong>[Meno vlastníka]</strong>,</p>
          <p>v bytovom dome <strong>Björnsonova 3</strong> bolo vyhlásené elektronické hlasovanie:</p>
          <div style={{ background: "var(--paper-2)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--line)", margin: "12px 0" }}>
            <h4 style={{ margin: "0 0 6px", color: "var(--primary)", fontSize: "14px" }}>{poll.title}</h4>
            <p style={{ margin: "0 0 4px", color: "var(--ink-soft)", fontSize: "12px" }}><strong>Dôvod:</strong> {poll.reason}</p>
            <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "12px" }}><strong>Termín na hlasovanie:</strong> do {formattedEnd}</p>
          </div>
          <p>Pre hlasovanie použite Váš osobný bezpečnostný odkaz (magic link):</p>
          <div style={{ textAlign: "center", margin: "20px 0" }}>
            <span style={{ display: "inline-block", backgroundColor: "var(--primary)", color: "#ffffff", padding: "10px 20px", borderRadius: 6, fontWeight: "bold", fontSize: "12px" }}>
              👉 HLASOVAŤ ELEKTRONICKY
            </span>
          </div>
          <p style={{ fontSize: "11px", color: "var(--ink-soft)", lineHeight: "1.4" }}>
            Poznámka: Za byt sa počíta jeden hlas (v prípade spoluvlastníctva podľa nahláseného režimu). Hlasovanie prebieha v zmysle zákona č. 182/1993 Z. z. Svoj hlas môžete do skončenia hlasovania kedykoľvek zmeniť.
          </p>
        </div>
      ))
    },
    {
      t: "Pripomienka (48 h pred koncom)",
      d: "Naplánované pred uzávierkou — odosiela sa iba nehlasujúcim",
      n: emailStats.unvotedEmailsCount,
      s: "scheduled",
      icon: "clock" as const,
      ...getEmailPreview("reminder", `UPOZORNENIE: Pripomienka k hlasovaniu: ${poll.title}`, (
        <div>
          <p>Vážený vlastník <strong>[Meno vlastníka]</strong>,</p>
          <p>pripomíname Vám prebiehajúce elektronické hlasovanie v dome <strong>Björnsonova 3</strong>, ktoré končí o 48 hodín:</p>
          <div style={{ background: "var(--paper-2)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--line)", margin: "12px 0" }}>
            <h4 style={{ margin: "0 0 6px", color: "var(--primary)", fontSize: "14px" }}>{poll.title}</h4>
            <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "12px" }}><strong>Koniec hlasovania:</strong> do {formattedEnd}</p>
          </div>
          <p>Ak ste doteraz neodovzdali svoj hlas, môžete tak urobiť kliknutím na odkaz nižšie:</p>
          <div style={{ textAlign: "center", margin: "20px 0" }}>
            <span style={{ display: "inline-block", backgroundColor: "var(--primary)", color: "#ffffff", padding: "10px 20px", borderRadius: 6, fontWeight: "bold", fontSize: "12px" }}>
              👉 HLASOVAŤ ELEKTRONICKY
            </span>
          </div>
        </div>
      ))
    },
    {
      t: "Potvrdenie prijatia hlasu",
      d: "Odosiela sa automaticky po každom odoslaní hlasu",
      n: emailStats.votedCount,
      s: "auto",
      icon: "checkCircle" as const,
      ...getEmailPreview("confirmation", `Potvrdenie o hlasovaní: ${poll.title}`, (
        <div>
          <p>Vážený vlastník <strong>[Meno vlastníka]</strong>,</p>
          <p>potvrdzujeme prijatie Vášho hlasu za byt/NP <strong>č. [Číslo bytu]</strong> v hlasovaní:</p>
          <div style={{ background: "var(--paper-2)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--line)", margin: "12px 0" }}>
            <h4 style={{ margin: "0 0 10px", color: "var(--primary)", fontSize: "14px" }}>{poll.title}</h4>
            <p style={{ color: "var(--ink-soft)", fontSize: "12px", margin: "0 0 8px" }}>Prijaté dňa: [Dátum a čas odovzdania]</p>
            <ul style={{ paddingLeft: "20px", margin: 0, fontSize: "12.5px" }}>
              <li style={{ marginBottom: "6px" }}>
                <strong>Otázka 1:</strong> [Text prvej otázky...] <br/>
                Odpoveď: <span style={{ fontWeight: "bold", color: "var(--agree)" }}>Súhlasím</span>
              </li>
              <li>
                <strong>Otázka 2:</strong> [Text druhej otázky...] <br/>
                Odpoveď: <span style={{ fontWeight: "bold", color: "var(--disagree)" }}>Nesúhlasím</span>
              </li>
            </ul>
          </div>
          <p>Váš hlas bol bezpečne zaznamenaný a zašifrovaný v auditnom logu.</p>
        </div>
      ))
    },
    {
      t: "Výsledok hlasovania",
      d: "Odosiela sa po overení a uzavretí hlasovania administrátorom",
      n: emailStats.eligibleEmailsCount,
      s: poll.status === "closed" ? "sent" : "pending",
      icon: "paper" as const,
      ...getEmailPreview("protocol", `Výsledky hlasovania: ${poll.title}`, (
        <div>
          <p>Vážený vlastník <strong>[Meno vlastníka]</strong>,</p>
          <p>oznamujeme Vám, že elektronické hlasovanie bolo ukončené a výsledky boli oficiálne zapečatené:</p>
          <div style={{ background: "var(--paper-2)", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--line)", margin: "12px 0" }}>
            <h4 style={{ margin: "0 0 6px", color: "var(--primary)", fontSize: "14px" }}>{poll.title}</h4>
            <p style={{ margin: "0 0 4px", color: "var(--ink-soft)", fontSize: "12px" }}><strong>Stav:</strong> Uzavreté a overené</p>
            <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "12px" }}><strong>Zápisnica (PDF):</strong> Súbor priložený v e-maile</p>
          </div>
          <p>Kompletnú zápisnicu o priebehu a výsledkoch si môžete stiahnuť aj priamo kliknutím na odkaz nižšie:</p>
          <div style={{ textAlign: "center", margin: "20px 0" }}>
            <span style={{ display: "inline-block", backgroundColor: "var(--primary)", color: "#ffffff", padding: "10px 20px", borderRadius: 6, fontWeight: "bold", fontSize: "12px" }}>
              Stiahnuť zápisnicu (PDF)
            </span>
          </div>
        </div>
      ))
    }
  ];
  const formattedAnnounced = new Date(poll.announcedAt).toLocaleDateString("sk-SK");
  const formattedStart = new Date(poll.startAt).toLocaleString("sk-SK", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const getStatusPill = (status: "approved" | "rejected" | "short") => {
    const map = {
      approved: { label: "Schválené", tone: "success", icon: "checkCircle" },
      rejected: { label: "Neschválené", tone: "danger", icon: "xCircle" },
      short: { label: "Zatiaľ nedosiahnutá väčšina", tone: "accent", icon: "clock" },
    };
    const details = map[status] || map.short;
    return (
      <Pill tone={details.tone as any} icon={details.icon}>
        {details.label}
      </Pill>
    );
  };

  const getMajorityLabel = (type: string) => {
    const normalized = type.replace("_", "-");
    const map: Record<string, string> = {
      "half-all": "Nadpolovičná väčšina všetkých vlastníkov",
      "twothirds-all": "Dvojtretinová väčšina všetkých vlastníkov",
      "fourfifths-all": "Štvorpätinová väčšina všetkých vlastníkov",
      all: "Súhlas všetkých vlastníkov",
      "half-present": "Nadpolovičná väčšina zúčastnených",
    };
    return map[normalized] || type;
  };

  const getMajorityFrac = (type: string) => {
    const normalized = type.replace("_", "-");
    const map: Record<string, string> = {
      "half-all": "> 1/2 všetkých",
      "twothirds-all": "≥ 2/3 všetkých",
      "fourfifths-all": "≥ 4/5 všetkých",
      all: "všetci",
      "half-present": "> 1/2 hlasujúcich",
    };
    return map[normalized] || type;
  };

  const renderVoteDot = (ans: string | null, isDisputed: boolean, note: string | null) => {
    if (isDisputed) {
      return (
        <span role="img" aria-label="Sporný hlas" title={note || "Sporný"}>
          <Ic name="alert" size={17} style={{ color: "var(--accent-ink)" }} />
        </span>
      );
    }
    if (!ans) {
      return (
        <span
          role="img"
          aria-label="Nehlasoval"
          style={{ width: 7, height: 7, borderRadius: 999, background: "var(--line)", display: "inline-block" }}
        />
      );
    }
    const map: Record<string, { c: string; i: string }> = {
      agree: { c: "var(--agree)", i: "check" },
      disagree: { c: "var(--disagree)", i: "x" },
      abstain: { c: "var(--abstain)", i: "minus" },
    };
    const v = map[ans];
    if (!v) return null;
    return (
      <span
        role="img"
        aria-label={ans}
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: v.c + "22",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ic name={v.i} size={14} sw={2.6} style={{ color: v.c }} />
      </span>
    );
  };

  return (
    <div className="admin-page-container">
      <PageHead eyebrow={`Bytový dom Björnsonova 3 · ${poll.status === "active" ? "prebieha" : "ukončené"}`} title={poll.title}>
        {userRole !== "vlastnik" && (
          <div style={{ display: "flex", gap: 8 }}>
            {poll.status === "active" && (
              <Btn kind="gold" icon="lock" onClick={() => setClosing(true)}>
                Uzavrieť hlasovanie
              </Btn>
            )}
            <Btn kind="ghost" icon="x" style={{ color: "var(--disagree)" }} onClick={handleDeletePoll}>
              Vymazať hlasovanie
            </Btn>
          </div>
        )}
      </PageHead>

      {/* Meta Strip */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 26px", marginBottom: 24, fontSize: "12.5px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink-soft)" }}>
          <Ic name="user" size={14} style={{ color: "var(--ink-faint)" }} />
          <span style={{ color: "var(--ink-faint)", fontWeight: 600 }}>Vyhlásil:</span>
          <span style={{ color: "var(--ink)", fontWeight: 600 }}>{poll.declarer}</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink-soft)" }}>
          <Ic name="bell" size={14} style={{ color: "var(--ink-faint)" }} />
          <span style={{ color: "var(--ink-faint)", fontWeight: 600 }}>Oznámené:</span>
          <span style={{ color: "var(--ink)", fontWeight: 600 }}>{formattedAnnounced}</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink-soft)" }}>
          <Ic name="clock" size={14} style={{ color: "var(--ink-faint)" }} />
          <span style={{ color: "var(--ink-faint)", fontWeight: 600 }}>Trvanie:</span>
          <span style={{ color: "var(--ink)", fontWeight: 600 }}>
            {formattedStart} → {formattedEnd}
          </span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink-soft)" }}>
          <Ic name="building" size={14} style={{ color: "var(--ink-faint)" }} />
          <span style={{ color: "var(--ink-faint)", fontWeight: 600 }}>Oprávnené hlasy:</span>
          <span style={{ color: "var(--ink)", fontWeight: 600 }}>{unitVotesList.length} jednotiek</span>
        </span>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Sekcie hlasovania"
        style={{
          display: "flex",
          gap: 2,
          borderBottom: "1px solid var(--line)",
          marginBottom: 26,
          overflowX: "auto",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => handleTabChange(t.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              flexShrink: 0,
              whiteSpace: "nowrap",
              padding: "11px 16px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "13.5px",
              fontWeight: 600,
              color: tab === t.id ? "var(--ink)" : "var(--ink-soft)",
              borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            <Ic name={t.icon} size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab contents */}
      {tab === "results" && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 16px",
              borderRadius: 10,
              background: "var(--primary-bg)",
              color: "var(--primary)",
              fontSize: 13,
              marginBottom: 22,
              lineHeight: 1.5,
            }}
          >
            <Ic name="eyeOff" size={18} style={{ flexShrink: 0 }} />
            Vlastníci počas hlasovania priebežné výsledky nevidia — túto obrazovku vidí iba administrátor.
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {questions.map((q) => (
              <Card pad={0} key={q.id} style={{ overflow: "hidden", marginBottom: 20 }}>
                <div
                  style={isMobile ? {
                    padding: "16px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  } : {
                    padding: "20px 24px",
                    display: "flex",
                    gap: 18,
                    alignItems: "flex-start",
                  }}
                >
                  {isMobile ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              background: "var(--primary)",
                              color: "#fff",
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontFamily: "var(--serif)",
                              fontSize: 15,
                              fontWeight: 600,
                            }}
                          >
                            {q.no}
                          </div>
                          <Pill tone="neutral" size="sm">
                            {q.kind}
                          </Pill>
                        </div>
                        <div>
                          {getStatusPill(q.tally.status)}
                        </div>
                      </div>
                      
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--ink-soft)", fontWeight: 600, flexWrap: "wrap" }}>
                        <Ic name="scale" size={13} style={{ flexShrink: 0 }} />
                        <span style={{ lineHeight: 1.3 }}>{getMajorityLabel(q.majorityType)}</span>
                      </div>

                      <div>
                        <h3 style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 600, margin: "0 0 6px", lineHeight: 1.3 }}>
                          {q.title}
                        </h3>
                        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.5 }}>
                          {q.text}
                        </p>
                        {q.attachments && q.attachments.length > 0 && (
                          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {q.attachments.map((url, uIdx) => {
                              const fileInfo = files.find(f => f.webViewLink === url);
                              const fileId = fileInfo ? fileInfo.id : extractDriveFileId(url);
                              const href = fileId ? `/api/file/${fileId}` : url;
                              const displayName = fileInfo ? fileInfo.name : "Podkladový dokument";
                              return (
                                <a
                                  key={uIdx}
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                    fontSize: "12px",
                                    color: "var(--primary)",
                                    textDecoration: "none",
                                    fontWeight: 600,
                                    background: "var(--primary-bg)",
                                    padding: "4px 10px",
                                    borderRadius: 6,
                                  }}
                                >
                                  <Ic name="doc" size={13} /> {displayName}
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          background: "var(--primary)",
                          color: "#fff",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "var(--serif)",
                          fontSize: 17,
                          fontWeight: 600,
                        }}
                      >
                        {q.no}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                          <Pill tone="neutral" size="sm">
                            {q.kind}
                          </Pill>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--ink-soft)", fontWeight: 600 }}>
                            <Ic name="scale" size={13} /> {getMajorityLabel(q.majorityType)}
                          </span>
                        </div>
                        <h3 style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600, margin: "0 0 6px" }}>
                          {q.title}
                        </h3>
                        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.5, maxWidth: 640 }}>
                          {q.text}
                        </p>
                        {q.attachments && q.attachments.length > 0 && (
                          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {q.attachments.map((url, uIdx) => {
                              const fileInfo = files.find(f => f.webViewLink === url);
                              const fileId = fileInfo ? fileInfo.id : extractDriveFileId(url);
                              const href = fileId ? `/api/file/${fileId}` : url;
                              const displayName = fileInfo ? fileInfo.name : "Podkladový dokument (Google Drive)";
                              return (
                                <a
                                  key={uIdx}
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                    fontSize: "12.5px",
                                    color: "var(--primary)",
                                    textDecoration: "none",
                                    fontWeight: 600,
                                    background: "var(--primary-bg)",
                                    padding: "5px 12px",
                                    borderRadius: 8,
                                  }}
                                >
                                  <Ic name="doc" size={14} /> {displayName}
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        {getStatusPill(q.tally.status)}
                      </div>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", borderTop: "1px solid var(--line)" }}>
                  <div style={{ flex: "1 1 340px", padding: "20px 24px", borderRight: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                      <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink-soft)" }}>
                        Hlasy „súhlasím" voči potrebnej väčšine
                      </span>
                      <span style={{ fontFamily: "var(--serif)", fontSize: 15, fontWeight: 600 }}>
                        {q.tally.agree} / <span style={{ color: "var(--ink-soft)" }}>{q.tally.need}</span>
                      </span>
                    </div>
                    
                    <Progress
                      height={12}
                      total={q.tally.total}
                      threshold={q.tally.need}
                      segments={[
                        { value: q.tally.agree, color: "var(--agree)" },
                        { value: q.tally.disagree, color: "var(--disagree)" },
                      ]}
                    />
                    
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 11, color: "var(--ink-faint)" }}>
                      <span>0</span>
                      <span style={{ fontWeight: 600, color: "var(--ink-soft)" }}>
                        ▲ potrebných {q.tally.need} z {q.tally.total} ({getMajorityFrac(q.majorityType)})
                      </span>
                      <span>{q.tally.total}</span>
                    </div>

                    {q.tally.status === "short" && (
                      <div
                        style={{
                          marginTop: 14,
                          fontSize: "12.5px",
                          color: "var(--accent-ink)",
                          background: "var(--accent-bg)",
                          padding: "9px 12px",
                          borderRadius: 8,
                          lineHeight: 1.45,
                        }}
                      >
                        Chýba ešte {q.tally.need - q.tally.agree} {q.tally.need - q.tally.agree === 1 ? "hlas" : "hlasov"}.
                        Väčšina sa počíta zo <strong>všetkých</strong> vlastníkov, nie len z hlasujúcich.
                      </div>
                    )}
                  </div>

                  <div style={{ flex: "1 1 240px", padding: "16px 24px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 9 }}>
                    {[
                      { label: "Súhlasím", v: q.tally.agree, c: "var(--agree)" },
                      { label: "Nesúhlasím", v: q.tally.disagree, c: "var(--disagree)" },
                      { label: "Nechcem hlasovať", v: q.tally.abstain, c: "var(--abstain)" },
                      { label: "Nehlasovali", v: q.tally.none, c: "var(--ink-faint)" },
                      { label: "Sporné byty", v: q.tally.disputed, c: "var(--accent-ink)" },
                    ].map((row, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: row.c, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 13, color: "var(--ink-soft)" }}>{row.label}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: row.v ? "var(--ink)" : "var(--ink-faint)" }}>
                          {row.v}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {q.attachments.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 24px",
                      borderTop: "1px solid var(--line)",
                      background: "var(--paper-2)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                      Prílohy
                    </span>
                    {q.attachments.map((a, i) => {
                      const fileInfo = files.find(f => f.name === a || f.webViewLink === a);
                      const fileId = fileInfo ? fileInfo.id : (a.startsWith("http") ? extractDriveFileId(a) : null);
                      const href = fileId ? `/api/file/${fileId}` : "#";
                      const displayName = fileInfo ? fileInfo.name : a;

                      return (
                        <a
                          key={i}
                          href={href}
                          target={href !== "#" ? "_blank" : undefined}
                          rel={href !== "#" ? "noopener noreferrer" : undefined}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: "12.5px",
                            color: "var(--primary)",
                            background: "var(--surface)",
                            border: "1px solid var(--line)",
                            borderRadius: 7,
                            padding: "5px 10px",
                            textDecoration: "none",
                            cursor: href !== "#" ? "pointer" : "default",
                            transition: "background .15s, border-color .15s",
                          }}
                          onMouseEnter={(e) => {
                            if (href !== "#") {
                              e.currentTarget.style.background = "var(--primary-bg)";
                              e.currentTarget.style.borderColor = "var(--primary)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (href !== "#") {
                              e.currentTarget.style.background = "var(--surface)";
                              e.currentTarget.style.borderColor = "var(--line)";
                            }
                          }}
                        >
                          <Ic name="doc" size={14} /> {displayName}
                        </a>
                      );
                    })}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "units" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
            {[
              { id: "all", l: "Všetky" },
              { id: "voted", l: "Hlasovali" },
              { id: "none", l: "Nehlasovali" },
              { id: "disputed", l: "Sporné" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                style={{
                  padding: "7px 13px",
                  borderRadius: 999,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  border: "1px solid var(--line)",
                  background: filter === f.id ? "var(--ink)" : "var(--surface)",
                  color: filter === f.id ? "#fff" : "var(--ink-soft)",
                }}
              >
                {f.l}
              </button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: "12.5px", color: "var(--ink-soft)" }}>
              {filteredVoterRows.length} jednotiek
            </span>
          </div>

          <Card pad={0}>
            <TableScroll minWidth={640}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "72px 1fr repeat(3, 84px) 160px",
                  padding: "11px 18px",
                  borderBottom: "1px solid var(--line)",
                  background: "var(--paper-2)",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--ink-faint)",
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  alignItems: "center",
                }}
              >
                <div>Jedn.</div>
                <div>Vlastník</div>
                {questions.map((q) => (
                  <div key={q.id} style={{ textAlign: "center" }}>
                    Ot. {q.no}
                  </div>
                ))}
                <div>Hlasoval</div>
              </div>

              {filteredVoterRows.map((row) => (
                <div
                  key={row.unitId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "72px 1fr repeat(3, 84px) 160px",
                    padding: "10px 18px",
                    borderBottom: "1px solid var(--line)",
                    alignItems: "center",
                    fontSize: 13,
                    background: row.disputed ? "var(--accent-bg)" : "transparent",
                  }}
                >
                  <div style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{row.unitNo}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {row.ownerName}
                    </div>
                    <div style={{ fontSize: "10.5px", color: "var(--ink-soft)" }}>{row.coMode}</div>
                  </div>
                  {row.answers.map((ans, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "center" }}>
                      {renderVoteDot(ans.answer, ans.disputed, ans.note)}
                    </div>
                  ))}
                  <div style={{ fontSize: "11.5px", color: "var(--ink-soft)" }}>
                    {row.voted ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {row.at ? new Date(row.at).toLocaleString("sk-SK", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                        {row.changed && <Pill tone="neutral" size="sm">zmenené</Pill>}
                      </span>
                    ) : (
                      <span style={{ color: "var(--ink-faint)" }}>—</span>
                    )}
                  </div>
                </div>
              ))}
            </TableScroll>
          </Card>
        </div>
      )}

      {tab === "emails" && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "14px 16px",
              borderRadius: 10,
              background: "var(--paper-2)",
              border: "1px solid var(--line)",
              fontSize: "12.5px",
              marginBottom: 22,
              lineHeight: 1.5,
            }}
          >
            <Ic name="shield" size={18} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 1 }} />
            <div>
              E-maily sa odosielajú jednotlivo cez <strong>Resend / Postmark API</strong>. Žiadny príjemca
              nevidí e-mailovú adresu iného vlastníka. Odkazy sú kryptograficky zabezpečené magic-linky.
            </div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {emailCards.map((m, i) => {
              const sTone: Record<string, string> = { sent: "success", scheduled: "primary", auto: "neutral", pending: "neutral" };
              const sLabel: Record<string, string> = { sent: "odoslané", scheduled: "naplánované", auto: "automatické", pending: "čaká" };
              const isExpanded = expandedEmailCard === i;

              // Helper for formatting date
              const formatDateStr = (dateStr: string | Date) => {
                const d = new Date(dateStr);
                return d.toLocaleString("sk-SK", {
                  day: "numeric",
                  month: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
              };

              return (
                <Card key={i} pad={0} style={{ overflow: "hidden" }}>
                  <div
                    onClick={() => setExpandedEmailCard(isExpanded ? null : i)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "15px 18px",
                      cursor: "pointer",
                      userSelect: "none",
                      background: isExpanded ? "var(--paper-2)" : "transparent",
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 9,
                        background: "var(--paper-2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Ic name={m.icon} size={18} style={{ color: "var(--ink-soft)" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{m.t}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 1 }}>{m.d}</div>
                    </div>
                    <span style={{ fontSize: "12.5px", color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums" }}>
                      {m.n} príjemcov
                    </span>
                    <Pill tone={sTone[m.s] as any} size="sm">
                      {sLabel[m.s]}
                    </Pill>
                    <Ic
                      name="chevD"
                      size={16}
                      style={{
                        color: "var(--ink-faint)",
                        transform: isExpanded ? "rotate(180deg)" : "none",
                        transition: "transform .2s",
                        flexShrink: 0,
                      }}
                    />
                  </div>

                  {isExpanded && (
                    <div style={{ padding: "12px 18px 18px", borderTop: "1px solid var(--line)", background: "var(--paper-2)" }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr",
                          gap: 24,
                          paddingLeft: isMobile ? 0 : 52,
                        }}
                      >
                        {/* Ľavý stĺpec: Zoznam príjemcov */}
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>
                            Zoznam príjemcov a stav doručenia
                          </div>
                          
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto", paddingRight: 8 }}>
                            {i === 0 && (() => {
                              const list = unitVotesList.flatMap(u =>
                                u.recipients.map(r => ({
                                  name: r.name,
                                  email: r.email,
                                  unitNo: u.unitNo,
                                  sentAt: r.sentAt,
                                }))
                              );
                              return list.map((item, idx) => {
                                const isResent = item.sentAt && (new Date(item.sentAt).getTime() - new Date(poll.announcedAt).getTime() > 10000);
                                return (
                                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, gap: 12, borderBottom: "1px solid var(--line)", paddingBottom: 6, flexWrap: "wrap" }}>
                                    <span style={{ minWidth: 200 }}>
                                      <strong>{item.name}</strong>{" "}
                                      <span style={{ color: "var(--ink-soft)", wordBreak: "break-all" }}>({item.email || "bez e-mailu"})</span> · Byt č. {item.unitNo}
                                    </span>
                                    {item.email ? (
                                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <span style={{ color: "var(--agree)", fontWeight: 500, fontSize: 12, whiteSpace: "nowrap" }}>
                                          {isResent ? `Znova odoslané ${formatDateStr(item.sentAt!)}` : `Odoslané ${formatDateStr(poll.announcedAt)}`}
                                        </span>
                                        <button
                                          onClick={() => handleResendEmail(item.email!, item.unitNo)}
                                          disabled={resendingEmail === `${item.unitNo}-${item.email}`}
                                          title="znova odoslať"
                                          style={{
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            color: isResent ? "var(--agree)" : "var(--primary)",
                                            padding: 2,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            opacity: resendingEmail === `${item.unitNo}-${item.email}` ? 0.5 : 1,
                                            transition: "transform 0.2s, opacity 0.2s",
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = "scale(1.15)";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = "scale(1)";
                                          }}
                                        >
                                          <Ic name="send" size={15} />
                                        </button>
                                      </div>
                                    ) : (
                                      <span style={{ color: "var(--disagree)", fontWeight: 500, fontSize: 12, whiteSpace: "nowrap" }}>
                                        Neodoslané (chyba kontaktu)
                                      </span>
                                    )}
                                  </div>
                                );
                              });
                            })()}

                            {i === 1 && (() => {
                              const list = unitVotesList
                                .filter(u => !u.voted)
                                .flatMap(u =>
                                  u.recipients.map(r => ({
                                    name: r.name,
                                    email: r.email,
                                    unitNo: u.unitNo,
                                    sentAt: r.sentAt,
                                  }))
                                );
                              if (list.length === 0) {
                                  return <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>Všetci vlastníci už zahlasovali. Žiadne pripomienky nie sú plánované.</div>;
                              }
                              return list.map((item, idx) => {
                                const isResent = item.sentAt && (new Date(item.sentAt).getTime() - new Date(poll.announcedAt).getTime() > 10000);
                                return (
                                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, gap: 12, borderBottom: "1px solid var(--line)", paddingBottom: 6, flexWrap: "wrap" }}>
                                    <span style={{ minWidth: 200 }}>
                                      <strong>{item.name}</strong>{" "}
                                      <span style={{ color: "var(--ink-soft)", wordBreak: "break-all" }}>({item.email || "bez e-mailu"})</span> · Byt č. {item.unitNo}
                                    </span>
                                    {item.email ? (
                                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <span style={{ color: isResent ? "var(--agree)" : "var(--primary)", fontWeight: 500, fontSize: 12, whiteSpace: "nowrap" }}>
                                          {isResent ? `Znova odoslané ${formatDateStr(item.sentAt!)}` : `Naplánované (48 h pred koncom)`}
                                        </span>
                                        <button
                                          onClick={() => handleResendEmail(item.email!, item.unitNo)}
                                          disabled={resendingEmail === `${item.unitNo}-${item.email}`}
                                          title="znova odoslať"
                                          style={{
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            color: isResent ? "var(--agree)" : "var(--primary)",
                                            padding: 2,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            opacity: resendingEmail === `${item.unitNo}-${item.email}` ? 0.5 : 1,
                                            transition: "transform 0.2s, opacity 0.2s",
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = "scale(1.15)";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = "scale(1)";
                                          }}
                                        >
                                          <Ic name="send" size={15} />
                                        </button>
                                      </div>
                                    ) : (
                                      <span style={{ color: "var(--ink-faint)", fontWeight: 500, fontSize: 12, whiteSpace: "nowrap" }}>
                                        Preskočené (chyba kontaktu)
                                      </span>
                                    )}
                                  </div>
                                );
                              });
                            })()}

                            {i === 2 && (() => {
                              const list = unitVotesList
                                .filter(u => u.voted && u.at)
                                .flatMap(u =>
                                  u.recipients.map(r => ({
                                    name: r.name,
                                    email: r.email,
                                    unitNo: u.unitNo,
                                    votedAt: u.at!,
                                  }))
                                );
                              if (list.length === 0) {
                                return <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>Zatiaľ neboli odovzdané žiadne hlasy.</div>;
                              }
                              return list.map((item, idx) => (
                                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: 13, gap: 12, borderBottom: "1px solid var(--line)", paddingBottom: 6, flexWrap: "wrap" }}>
                                  <span style={{ minWidth: 200 }}>
                                    <strong>{item.name}</strong>{" "}
                                    <span style={{ color: "var(--ink-soft)", wordBreak: "break-all" }}>({item.email || "bez e-mailu"})</span> · Byt č. {item.unitNo}
                                  </span>
                                  {item.email ? (
                                    <span style={{ color: "var(--agree)", fontWeight: 500, fontSize: 12, whiteSpace: "nowrap" }}>
                                      Potvrdené {formatDateStr(item.votedAt)}
                                    </span>
                                  ) : (
                                    <span style={{ color: "var(--ink-faint)", fontWeight: 500, fontSize: 12, whiteSpace: "nowrap" }}>
                                      Odoslané na email jednotky
                                    </span>
                                  )}
                                </div>
                              ));
                            })()}

                            {i === 3 && (() => {
                              const list = unitVotesList.flatMap(u =>
                                u.recipients.map(r => ({
                                  name: r.name,
                                  email: r.email,
                                  unitNo: u.unitNo,
                                }))
                              );
                              if (poll.status !== "closed") {
                                return (
                                  <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                                    Výsledky budú automaticky odoslané všetkým {list.filter(item => item.email).length} príjemcom po overení a uzavretí hlasovania.
                                  </div>
                                );
                              }
                              return list.map((item, idx) => (
                                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: 13, gap: 12, borderBottom: "1px solid var(--line)", paddingBottom: 6, flexWrap: "wrap" }}>
                                  <span style={{ minWidth: 200 }}>
                                    <strong>{item.name}</strong>{" "}
                                    <span style={{ color: "var(--ink-soft)", wordBreak: "break-all" }}>({item.email || "bez e-mailu"})</span> · Byt č. {item.unitNo}
                                  </span>
                                  {item.email ? (
                                    <span style={{ color: "var(--agree)", fontWeight: 500, fontSize: 12, whiteSpace: "nowrap" }}>
                                      Odoslané {formatDateStr(poll.sealedResult ? poll.endAt : poll.endAt)}
                                    </span>
                                  ) : (
                                    <span style={{ color: "var(--disagree)", fontWeight: 500, fontSize: 12, whiteSpace: "nowrap" }}>
                                      Neodoslané (chyba kontaktu)
                                    </span>
                                  )}
                                </div>
                              ));
                            })()}
                          </div>
                        </div>

                        {/* Pravý stĺpec: Náhľad textu e-mailu */}
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>
                            Znenie e-mailu (vzor)
                          </div>
                          
                          <div
                            style={{
                              background: "var(--surface)",
                              border: "1px solid var(--line)",
                              borderRadius: 8,
                              padding: "14px 16px",
                              fontSize: 13,
                              lineHeight: 1.5,
                              color: "var(--ink)",
                              maxHeight: 300,
                              overflowY: "auto",
                            }}
                          >
                            <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: 8, marginBottom: 12, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.45 }}>
                              <strong>Odosielateľ:</strong> info@hlasujme.sk<br/>
                              <strong>Predmet:</strong> {m.subject}
                            </div>
                            {m.body}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {emailStats.missingEmailsCount > 0 && (
            <>
              <SectionTitle>Chyby doručenia</SectionTitle>
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: "var(--disagree-bg)",
                      color: "var(--disagree)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Ic name="alert" size={17} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong>Byty: {emailStats.missingEmailsUnits.join(", ")}</strong> — vlastníci nemajú zadanú
                    e-mailovú adresu. Pozvánky neboli doručené. Zabezpečte náhradné doručenie alebo doplňte kontakt v
                    karte Dom a vlastníci.
                  </div>
                  <Link href="/admin/register" style={{ textDecoration: "none" }}>
                    <Btn kind="secondary" size="sm">
                      Doplniť e-maily
                    </Btn>
                  </Link>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === "protocol" && (
        <div>
          {poll.status === "active" ? (
            <Card style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "var(--accent-bg)",
                    color: "var(--accent-ink)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Ic name="lock" size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 600, margin: "0 0 5px" }}>
                    Hlasovanie ešte prebieha
                  </h3>
                  <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.5, maxWidth: 560 }}>
                    Zápisnicu je možné vygenerovať až po skončení termínu alebo po manuálnom uzavretí hlasovania. Do
                    skončenia termínu môžu vlastníci svoje odpovede meniť.
                  </p>
                </div>
                <Btn kind="gold" icon="lock" onClick={() => setClosing(true)}>
                  Uzavrieť teraz
                </Btn>
              </div>
            </Card>
          ) : (
            <Card style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "var(--agree-bg)",
                    color: "var(--agree)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Ic name="checkCircle" size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 600, margin: "0 0 5px" }}>
                    Hlasovanie bolo uzavreté a výsledky sú zapečatené
                  </h3>
                  <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.5, maxWidth: 560 }}>
                    Zápisnica bola úspešne vygenerovaná. Môžete ju stiahnuť nižšie alebo odoslať odkaz na stiahnutie všetkým vlastníkom.
                  </p>
                  
                  {protocolError && (
                    <div style={{ color: "var(--disagree)", fontSize: "12.5px", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                      <Ic name="alert" size={14} />
                      {protocolError}
                    </div>
                  )}

                  {protocolSuccess && (
                    <div style={{ color: "var(--agree)", fontSize: "12.5px", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                      <Ic name="checkCircle" size={14} />
                      {protocolSuccess}
                    </div>
                  )}
                </div>
                
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  {poll.sealedResult && (
                    <a href={`/api/sealed/${poll.id}/pdf`} style={{ textDecoration: "none" }}>
                      <Btn kind="secondary" icon="download">
                        Stiahnuť zápisnicu PDF
                      </Btn>
                    </a>
                  )}
                  <Btn
                    kind="primary"
                    icon="send"
                    disabled={sendingProtocol}
                    onClick={handleSendProtocolToOwners}
                  >
                    {sendingProtocol ? "Odosielam..." : "Odoslať vlastníkom"}
                  </Btn>
                </div>
              </div>
            </Card>
          )}

          {/* Sent Protocol Email Logs */}
          {poll.status === "closed" && (
            <div style={{ marginTop: 24, marginBottom: 24 }}>
              <h4 style={{ fontFamily: "var(--serif)", fontSize: 16, fontWeight: 600, margin: "0 0 10px", color: "var(--ink)" }}>
                História odoslania zápisnice
              </h4>
              {poll.protocolEmailLogs && poll.protocolEmailLogs.length > 0 ? (
                <Card style={{ padding: 0 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--line)", background: "var(--paper-2)", textAlign: "left" }}>
                        <th style={{ padding: "10px 14px", fontWeight: 600, color: "var(--ink-soft)" }}>E-mailová adresa</th>
                        <th style={{ padding: "10px 14px", fontWeight: 600, color: "var(--ink-soft)" }}>Čas odoslania</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poll.protocolEmailLogs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: "1px solid var(--line)" }}>
                          <td style={{ padding: "10px 14px", color: "var(--ink)", fontWeight: 500 }}>{log.email}</td>
                          <td style={{ padding: "10px 14px", color: "var(--ink-soft)" }}>
                            {new Date(log.sentAt).toLocaleString("sk-SK", {
                              day: "numeric",
                              month: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit"
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              ) : (
                <div style={{ fontSize: "13px", color: "var(--ink-soft)", background: "var(--paper)", padding: "12px 14px", borderRadius: 8, border: "1px dashed var(--line)" }}>
                  Odkaz na zápisnicu zatiaľ nebol odoslaný žiadnemu vlastníkovi.
                </div>
              )}
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginBottom: 16,
              marginTop: 10,
            }}
          >
            <div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>
                Obsah zápisnice (PDF)
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 2 }}>
                Vygenerované automaticky po uzavretí
              </div>
            </div>
          </div>
          
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 28px" }}>
              {[
                "Identifikácia domu, vchodu a správcu",
                "Dátum, čas a dĺžka trvania hlasovania",
                "Meno vyhlasovateľa hlasovania",
                "Úplné a presné znenie otázok",
                "Právny typ väčšiny pre každú otázku",
                "Počet všetkých oprávnených hlasov v dome",
                "Počty hlasov za / proti / zdržal sa / nehlasoval",
                "Výsledok schválenia každej otázky",
                "Nemenná časová pečiatka uzavretia",
                "Menný zoznam hlasovania jednotiek (príloha)",
              ].map((x, i) => (
                <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13 }}>
                  <Ic name="check" size={16} sw={2.4} style={{ color: "var(--agree)", flexShrink: 0, marginTop: 2 }} />
                  {x}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "documents" && (
        <div>
          <Card style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: isMobile ? "wrap" : "nowrap" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "var(--accent-bg)",
                  color: "var(--accent-ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Ic name="folder" size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <h4 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 600 }}>Podklady na stiahnutie</h4>
                <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.4 }}>
                  {userRole === "vlastnik"
                    ? "Tieto dokumenty sú priložené k tomuto hlasovaniu. Môžete si ich kedykoľvek stiahnuť a prezerať."
                    : "Tieto dokumenty sú uložené v zložke Google Drive. Môžete sem nahrať nové podklady alebo dokumenty k hlasovaniu, ktoré si vlastníci a administrátori môžu stiahnuť a prezerať."}
                </p>
              </div>
              {userRole !== "vlastnik" && (
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, width: isMobile ? "100%" : "auto" }}>
                  <label style={{ display: "inline-block", cursor: "pointer", width: "100%" }}>
                    <input
                      type="file"
                      style={{ display: "none" }}
                      disabled={uploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        setUploading(true);
                        setUploadError("");
                        
                        const formData = new FormData();
                        formData.append("file", file);
                        
                        try {
                          const res = await fetch(`/api/admin/poll/${poll.id}/upload`, {
                            method: "POST",
                            body: formData,
                          });
                          
                          if (res.ok) {
                            fetchFiles(); // Reload files
                          } else {
                            const data = await res.json();
                            setUploadError(data.error || "Nahrávanie zlyhalo.");
                          }
                        } catch (err) {
                          setUploadError("Chyba spojenia pri nahrávaní.");
                        } finally {
                          setUploading(false);
                        }
                      }}
                    />
                    <Btn kind="primary" icon={uploading ? "clock" : "plus"} disabled={uploading} style={{ width: "100%" }}>
                      {uploading ? "Nahrávam..." : "Nahrať dokument"}
                    </Btn>
                  </label>
                  {uploadError && <div style={{ fontSize: 12, color: "var(--disagree)" }}>{uploadError}</div>}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 12 }}>
              Nahraté dokumenty
            </div>

            {loadingFiles ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "var(--ink-soft)", fontSize: 14 }}>
                Načítavam súbory z Google Drive...
              </div>
            ) : files.length === 0 ? (
              <div style={{ padding: "30px 10px", textAlign: "center", color: "var(--ink-soft)", fontSize: 14 }}>
                <Ic name="folder" size={24} style={{ color: "var(--ink-faint)", marginBottom: 8, display: "block", margin: "0 auto" }} />
                Zatiaľ neboli nahraté žiadne podklady.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {files.map((file) => (
                  <div
                    key={file.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      background: "var(--paper-2)",
                      borderRadius: 10,
                      border: "1px solid var(--line)",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 200 }}>
                      <Ic name="paper" size={17} style={{ color: "var(--primary)", flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 500, wordBreak: "break-all" }}>{file.name}</span>
                    </div>
                    <Link href={file.webViewLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                      <Btn kind="secondary" size="sm" icon="eye">
                        Otvoriť
                      </Btn>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {closing && (
        <CloseModal
          pollId={poll.id}
          pollTitle={poll.title}
          questions={questions.map((q) => ({
            no: q.no,
            title: q.title,
            agree: q.tally.agree,
            need: q.tally.need,
            status: q.tally.status,
          }))}
          conflictChecks={{
            disputedUnitsCount: emailStats.votedCount > 0 ? disputedUnitsCount : 0,
            disputedUnitsList: disputedUnitsList.map(u => `Byt č. ${u.unitNo} — sporný hlas`),
            missingEmailsCount: emailStats.missingEmailsCount,
            missingEmailsList: emailStats.missingEmailsUnits.map(no => `Byt č. ${no} — chýba email`),
          }}
          onClose={() => setClosing(false)}
          onSuccess={() => {
            setClosing(false);
            handleTabChange("protocol");
            router.refresh();
          }}
        />
      )}
    </div>
  );
};

// Section title helper component
const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16, marginTop: 22 }}>
    <div style={{ fontFamily: "var(--serif)", fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>{children}</div>
  </div>
);
