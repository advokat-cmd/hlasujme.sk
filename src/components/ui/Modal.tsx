"use client";

import React, { useEffect, useId, useRef } from "react";
import { useNarrow } from "./LayoutHelpers";
import { Ic } from "./Icons";

interface ModalProps {
  title: string;
  subtitle?: string;
  icon?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}

export const Modal: React.FC<ModalProps> = ({
  title,
  subtitle,
  icon = "edit",
  onClose,
  children,
  footer,
  width = 560,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const isMobile = useNarrow(600);
  const titleId = `modal-title-${useId().replace(/:/g, "")}`;

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const panel = panelRef.current;
    const prevFocus = document.activeElement as HTMLElement | null;
    
    if (panel) {
      panel.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      
      if (e.key === "Tab" && panel) {
        const focusableElements = panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements.length) return;
        
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (prevFocus && prevFocus.focus) {
        prevFocus.focus();
      }
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,26,38,.5)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: isMobile ? 8 : 20,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: "100%",
          maxHeight: isMobile ? "96vh" : "92vh",
          overflow: "auto",
          background: "var(--surface)",
          borderRadius: isMobile ? 12 : 16,
          boxShadow: "0 30px 80px -20px rgba(0,0,0,.5)",
          outline: "none",
        }}
      >
        <div
          style={{
            padding: isMobile ? "14px 16px" : "18px 22px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            position: "sticky",
            top: 0,
            background: "var(--surface)",
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: "var(--primary-bg)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Ic name={icon} size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 id={titleId} style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600, margin: 0 }}>
              {title}
            </h3>
            {subtitle && <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            aria-label="Zavrieť"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-faint)",
              display: "flex",
              padding: 4,
            }}
          >
            <Ic name="x" size={20} />
          </button>
        </div>
        <div style={{ padding: isMobile ? "16px 16px" : "20px 22px" }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: isMobile ? "12px 16px" : "14px 22px",
              borderTop: "1px solid var(--line)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              position: "sticky",
              bottom: 0,
              background: "var(--surface)",
              zIndex: 2,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
