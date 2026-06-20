import React from "react";
import { Ic } from "./Icons";

interface PillProps {
  tone?: "neutral" | "agree" | "disagree" | "abstain" | "accent" | "primary" | "success" | "danger";
  children: React.ReactNode;
  icon?: string;
  size?: "sm" | "md";
}

export const VOTE_STYLE = {
  agree: { bg: "var(--agree-bg)", fg: "var(--agree)", label: "Súhlasím", icon: "check" },
  disagree: { bg: "var(--disagree-bg)", fg: "var(--disagree)", label: "Nesúhlasím", icon: "x" },
  abstain: { bg: "var(--abstain-bg)", fg: "var(--abstain)", label: "Nechcem hlasovať", icon: "minus" },
  none: { bg: "var(--paper-2)", fg: "var(--ink-faint)", label: "Nehlasoval", icon: "clock" },
  disputed: { bg: "var(--accent-bg)", fg: "var(--accent-ink)", label: "Sporný byt", icon: "alert" },
};

export const Pill: React.FC<PillProps> = ({
  tone = "neutral",
  children,
  icon,
  size = "md",
}) => {
  const tones = {
    neutral: { bg: "var(--paper-2)", fg: "var(--ink-soft)" },
    agree: { bg: "var(--agree-bg)", fg: "var(--agree)" },
    disagree: { bg: "var(--disagree-bg)", fg: "var(--disagree)" },
    abstain: { bg: "var(--abstain-bg)", fg: "var(--abstain)" },
    accent: { bg: "var(--accent-bg)", fg: "var(--accent-ink)" },
    primary: { bg: "var(--primary-bg)", fg: "var(--primary)" },
    success: { bg: "var(--agree-bg)", fg: "var(--agree)" },
    danger: { bg: "var(--disagree-bg)", fg: "var(--disagree)" },
  };

  const t = tones[tone] || tones.neutral;
  const fs = size === "sm" ? 11 : 12;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: size === "sm" ? "2px 8px" : "4px 10px",
        borderRadius: 999,
        fontSize: fs,
        fontWeight: 600,
        letterSpacing: 0.2,
        background: t.bg,
        color: t.fg,
        whiteSpace: "nowrap",
      }}
    >
      {icon && <Ic name={icon} size={fs + 2} sw={2.2} />}
      {children}
    </span>
  );
};
