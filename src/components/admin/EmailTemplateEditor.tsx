"use client";

import React, { useState, useEffect, useRef } from "react";
import { Ic } from "../ui/Icons";
import { Btn } from "../ui/Button";
import { sanitizeEmailPreview } from "@/lib/security/html";

interface EmailTemplateEditorProps {
  value: string;
  onChange: (val: string) => void;
  onInsertRef: React.MutableRefObject<((text: string) => void) | null>;
  templateKey: string;
  onResetDefault: () => void;
}

export const DEFAULT_EMAIL_TEMPLATES: Record<string, { subject: string; body: string }> = {
  invitation: {
    subject: "Pozvánka na hlasovanie: {pollTitle}",
    body: `<h2>Pozvánka na elektronické hlasovanie</h2>
<p>Vážený vlastník <strong>{ownerName}</strong>,</p>
<p>v bytovom dome <strong>{buildingName}</strong> bolo vyhlásené elektronické hlasovanie:</p>

<div class="box">
  <h3>{pollTitle}</h3>
  <p class="meta"><strong>Dôvod:</strong> {pollReason}</p>
  <p class="meta"><strong>Termín na hlasovanie:</strong> do {endFormatted}</p>
</div>

<p>Pre hlasovanie použite Váš osobný bezpečnostný odkaz (magic link) nižšie. Nikomu tento odkaz neposielajte, slúži ako Vaša jednoznačná identifikácia:</p>

<div style="text-align: center; margin: 25px 0;">
  <a class="btn" href="{magicLink}">👉 HLASOVAŤ ELEKTRONICKY</a>
</div>

<p class="note">
  Poznámka: Za byt sa počíta jeden hlas (v prípade spoluvlastníctva podľa nahláseného režimu). Hlasovanie prebieha v zmysle zákona č. 182/1993 Z. z. Svoj hlas môžete do skončenia hlasovania kedykoľvek zmeniť kliknutím na tento odkaz — započíta sa posledné odoslané hlasovanie.
</p>`
  },
  reminder: {
    subject: "UPOZORNENIE: Pripomienka k hlasovaniu: {pollTitle}",
    body: `<h2>Pripomienka k elektronickému hlasovaniu</h2>
<p>Vážený vlastník <strong>{ownerName}</strong>,</p>
<p>pripomíname Vám prebiehajúce elektronické hlasovanie v dome <strong>{buildingName}</strong>, ktoré končí o 48 hodín:</p>

<div class="box">
  <h3>{pollTitle}</h3>
  <p class="meta"><strong>Koniec hlasovania:</strong> do {endFormatted}</p>
</div>

<p>Ak ste doteraz neodovzdali svoj hlas, môžete tak urobiť kliknutím na odkaz nižšie:</p>

<div style="text-align: center; margin: 25px 0;">
  <a class="btn" href="{magicLink}">👉 HLASOVAŤ ELEKTRONICKY</a>
</div>`
  },
  confirmation: {
    subject: "Potvrdenie o hlasovaní: {pollTitle}",
    body: `<h2>Potvrdenie o hlasovaní</h2>
<p>Vážený vlastník <strong>{ownerName}</strong>,</p>
<p>potvrdzujeme prijatie Vášho hlasu za byt/NP <strong>č. {unitNo}</strong> v hlasovaní:</p>

<div class="box">
  <h3>{pollTitle}</h3>
  <p class="meta"><strong>Prijaté dňa:</strong> {dateFormatted}</p>
  <ul style="padding-left: 20px; margin: 0; font-size: 13.5px; line-height: 1.5; color: #5C6473;">
    {answersList}
  </ul>
</div>

<p>Váš hlas bol bezpečne zaznamenaný a zašifrovaný v auditnom logu. Do uzávierky môžete svoje rozhodnutie zmeniť opätovným otvorením Vášho magic-linku v pôvodnom e-maile.</p>`
  },
  protocol: {
    subject: "Výsledok hlasovania: {pollTitle}",
    body: `<h2>Výsledok hlasovania</h2>
<p>Vážený vlastník <strong>{ownerName}</strong>,</p>
<p>oznamujeme Vám, že elektronické hlasovanie bolo ukončené a výsledky boli oficiálne zapečatené:</p>

<div class="box">
  <h3>{pollTitle}</h3>
  <p class="meta"><strong>Stav:</strong> Uzavreté a overené</p>
  <p class="meta"><strong>Zápisnica (PDF):</strong> Na stiahnutie kliknutím na odkaz nižšie</p>
</div>

<p>Kompletnú zápisnicu o priebehu a výsledkoch si môžete stiahnuť aj priamo kliknutím na odkaz nižšie (odkaz nevyžaduje prihlásenie):</p>

<div style="text-align: center; margin: 25px 0;">
  <a class="btn" href="{protocolLink}">Stiahnuť zápisnicu (PDF)</a>
</div>`
  },
  credentials: {
    subject: "Prihlasovacie údaje: Bytový dom {buildingShort}",
    body: `<h2>Prihlasovacie údaje k hlasovaciemu systému</h2>
<p>Dobrý deň, <strong>{ownerName}</strong>,</p>
<p>administrátor bytového domu <strong>{buildingName}</strong> Vám vygeneroval prístup do klientskej zóny hlasovacieho systému, kde si môžete kedykoľvek prečítať a stiahnuť výsledky hlasovaní.</p>

<div class="box">
  <p class="meta"><strong>Prihlasovacia stránka:</strong> <a href="{loginLink}">{loginLink}</a></p>
  <p class="meta"><strong>Prihlasovací e-mail:</strong> {loginEmail}</p>
  <p class="meta"><strong>Prihlasovacie heslo:</strong> <code class="pass">{rawPassword}</code></p>
</div>

<p class="warn">
  ⚠️ Dôležité upozornenie: Pri prvom prihlásení Vás systém vyzve na zmenu tohto automaticky vygenerovaného hesla za Vaše vlastné bezpečné heslo.
</p>

<p class="note">
  Tento e-mail bol odoslaný automaticky. Neodpovedajte naň.
</p>`
  }
};

export const EmailTemplateEditor: React.FC<EmailTemplateEditorProps> = ({
  value,
  onChange,
  onInsertRef,
  templateKey,
  onResetDefault
}) => {
  const [editorMode, setEditorMode] = useState<"wysiwyg" | "code">("wysiwyg");
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTemplateKey = useRef(templateKey);

  // Sync state on template change
  useEffect(() => {
    if (templateKey !== lastTemplateKey.current) {
      lastTemplateKey.current = templateKey;
      if (editorRef.current) {
        editorRef.current.innerHTML = sanitizeEmailPreview(value);
      }
    }
  }, [templateKey, value]);

  // Set initial content
  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML && value) {
      editorRef.current.innerHTML = sanitizeEmailPreview(value);
    }
  }, [value]);

  // Expose insertion handler
  useEffect(() => {
    onInsertRef.current = (text: string) => {
      if (editorMode === "code") {
        const textarea = textareaRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const currentText = textarea.value;
          const newText = currentText.substring(0, start) + text + currentText.substring(end);
          onChange(newText);
          
          // Re-focus and position cursor
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + text.length, start + text.length);
          }, 0);
        }
      } else {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const editor = editorRef.current;
          if (editor && editor.contains(range.commonAncestorContainer)) {
            range.deleteContents();
            const textNode = document.createTextNode(text);
            range.insertNode(textNode);
            
            // Move cursor to after inserted text
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            sel.removeAllRanges();
            sel.addRange(range);
            
            onChange(editor.innerHTML);
            return;
          }
        }
        
        // Fallback: append
        if (editorRef.current) {
          editorRef.current.innerHTML += text;
          onChange(editorRef.current.innerHTML);
        }
      }
    };

    return () => {
      onInsertRef.current = null;
    };
  }, [editorMode, onChange, onInsertRef]);

  const handleEditorInput = (e: React.FormEvent<HTMLDivElement>) => {
    onChange(e.currentTarget.innerHTML);
  };

  const execCommand = (command: string, arg: string = "") => {
    if (editorMode === "wysiwyg") {
      document.execCommand(command, false, arg);
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    }
  };

  const insertCustomBlock = (type: "box" | "btn" | "warn" | "note") => {
    if (editorMode !== "wysiwyg") return;
    
    let blockHtml = "";
    if (type === "box") {
      blockHtml = `<div class="box"><h3>Nadpis sekcie</h3><p class="meta">Popis a údaje...</p></div>`;
    } else if (type === "btn") {
      blockHtml = `<div style="text-align: center; margin: 25px 0;"><a class="btn" href="{magicLink}">👉 HLASOVAŤ ELEKTRONICKY</a></div>`;
    } else if (type === "warn") {
      blockHtml = `<p class="warn">⚠️ Upozornenie: Dôležité informácie...</p>`;
    } else if (type === "note") {
      blockHtml = `<p class="note">Poznámka: Tento e-mail bol odoslaný automaticky...</p>`;
    }

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const editor = editorRef.current;
      if (editor && editor.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        const div = document.createElement("div");
        div.innerHTML = blockHtml;
        const fragment = document.createDocumentFragment();
        let child = div.firstChild;
        while (child) {
          const next = child.nextSibling;
          fragment.appendChild(child);
          child = next;
        }
        range.insertNode(fragment);
        onChange(editor.innerHTML);
        return;
      }
    }

    if (editorRef.current) {
      editorRef.current.innerHTML += blockHtml;
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleModeToggle = (mode: "wysiwyg" | "code") => {
    if (mode === editorMode) return;
    
    if (mode === "code") {
      // Sync wysiwyg changes to state before going to code view
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    } else {
      // Sync code changes to wysiwyg before visual view
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = sanitizeEmailPreview(value);
        }
      }, 0);
    }
    setEditorMode(mode);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Scope visual stylesheet matching the final email styles inside the visual editor */}
      <style dangerouslySetInnerHTML={{ __html: `
        .email-editor-content {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #1B2330;
          background: #F4F1EA;
          padding: 20px;
          border: 1px solid #E5DFD3;
          border-radius: 12px;
          min-height: 350px;
          max-height: 480px;
          overflow-y: auto;
          outline: none;
          text-align: left;
          box-sizing: border-box;
        }
        .email-editor-content h2 {
          font-family: Georgia, serif;
          color: #1F3A5F;
          margin-top: 0;
          font-size: 18px;
          font-weight: 600;
          border-bottom: 2px solid #1F3A5F;
          padding-bottom: 8px;
          line-height: 1.3;
        }
        .email-editor-content h3 {
          margin-top: 0;
          color: #1F3A5F;
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .email-editor-content .box {
          background: #ffffff;
          padding: 15px;
          border-radius: 8px;
          border: 1px solid #E5DFD3;
          margin: 15px 0;
          font-size: 13.5px;
        }
        .email-editor-content .btn {
          background-color: #1F3A5F;
          color: #ffffff;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
          display: inline-block;
          font-size: 13.5px;
          cursor: default;
        }
        .email-editor-content .note {
          font-size: 12px;
          color: #606673;
          line-height: 1.4;
          margin: 10px 0 0;
        }
        .email-editor-content .meta {
          margin: 0 0 8px;
          color: #5C6473;
          font-size: 13.5px;
          line-height: 1.4;
        }
        .email-editor-content .warn {
          font-size: 13px;
          color: #b91c1c;
          font-weight: 600;
          line-height: 1.5;
          background: #fffbeb;
          border: 1px solid #fef3c7;
          padding: 10px 12px;
          border-radius: 6px;
          margin: 18px 0;
        }
        .email-editor-content .pass {
          font-family: monospace;
          font-size: 15px;
          color: #b91c1c;
          font-weight: bold;
          background: #fee2e2;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .email-editor-content p {
          font-size: 14px;
          line-height: 1.5;
          color: #334155;
          margin: 10px 0;
        }
        .editor-tb-btn {
          background: none;
          border: 1px solid var(--line);
          border-radius: 6px;
          padding: 5px 8px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ink);
          font-weight: 500;
          gap: 4px;
          transition: all 0.15s;
        }
        .editor-tb-btn:hover {
          background: var(--paper-2);
          border-color: var(--ink-soft);
        }
      ` }} />

      {/* Editor switcher tabs & Reset */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => handleModeToggle("wysiwyg")}
            style={{
              background: editorMode === "wysiwyg" ? "var(--primary-bg)" : "none",
              border: "none",
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: "12.5px",
              fontWeight: 600,
              color: editorMode === "wysiwyg" ? "var(--primary)" : "var(--ink-soft)",
              cursor: "pointer",
              transition: "all 0.15s"
            }}
          >
            Vizuálny editor
          </button>
          <button
            type="button"
            onClick={() => handleModeToggle("code")}
            style={{
              background: editorMode === "code" ? "var(--primary-bg)" : "none",
              border: "none",
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: "12.5px",
              fontWeight: 600,
              color: editorMode === "code" ? "var(--primary)" : "var(--ink-soft)",
              cursor: "pointer",
              transition: "all 0.15s"
            }}
          >
            HTML kód
          </button>
        </div>

        <Btn kind="ghost" size="sm" icon="refresh" onClick={onResetDefault} style={{ color: "var(--ink-soft)" }}>
          Reset šablóny
        </Btn>
      </div>

      {/* WYSIWYG Toolbar */}
      {editorMode === "wysiwyg" && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", background: "var(--paper-2)", padding: 6, borderRadius: 8, border: "1px solid var(--line)" }}>
          <button type="button" className="editor-tb-btn" onClick={() => execCommand("bold")} title="Tučné">
            <strong>B</strong>
          </button>
          <button type="button" className="editor-tb-btn" onClick={() => execCommand("italic")} title="Kurzíva">
            <em>I</em>
          </button>
          <button type="button" className="editor-tb-btn" onClick={() => execCommand("underline")} title="Podčiarknuté">
            <u>U</u>
          </button>
          
          <div style={{ width: 1, background: "var(--line)", margin: "2px 4px" }} />

          <button type="button" className="editor-tb-btn" onClick={() => execCommand("formatBlock", "h2")} title="Nadpis H2">
            H2
          </button>
          <button type="button" className="editor-tb-btn" onClick={() => execCommand("formatBlock", "h3")} title="Nadpis H3">
            H3
          </button>
          <button type="button" className="editor-tb-btn" onClick={() => execCommand("formatBlock", "p")} title="Odstavec">
            P
          </button>

          <div style={{ width: 1, background: "var(--line)", margin: "2px 4px" }} />

          <button type="button" className="editor-tb-btn" onClick={() => execCommand("insertUnorderedList")} title="Zoznam s odrážkami">
            • Odrážky
          </button>

          <div style={{ width: 1, background: "var(--line)", margin: "2px 4px" }} />

          <button type="button" className="editor-tb-btn" onClick={() => insertCustomBlock("box")} title="Vložiť bielu kartu/box">
            + Rámček
          </button>
          <button type="button" className="editor-tb-btn" onClick={() => insertCustomBlock("btn")} title="Vložiť tlačidlo">
            + Tlačidlo
          </button>
          <button type="button" className="editor-tb-btn" onClick={() => insertCustomBlock("warn")} title="Vložiť varovanie">
            + Varovanie
          </button>
          <button type="button" className="editor-tb-btn" onClick={() => insertCustomBlock("note")} title="Vložiť poznámku">
            + Poznámka
          </button>
        </div>
      )}

      {/* Editor Fields */}
      {editorMode === "wysiwyg" ? (
        <div
          id="wysiwyg-email-editor"
          ref={editorRef}
          className="email-editor-content"
          contentEditable
          onInput={handleEditorInput}
          style={{ border: "1px solid var(--line)" }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Sem zadajte HTML kód šablóny..."
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid var(--line)",
            fontFamily: "monospace",
            fontSize: "13px",
            background: "#1E293B",
            color: "#F8FAFC",
            minHeight: 380,
            maxHeight: 500,
            resize: "vertical",
            lineHeight: 1.5,
            outline: "none"
          }}
        />
      )}
    </div>
  );
};
