"use client";

import React, { useState } from "react";
import { Ic } from "./Icons";

interface BtnProps {
  children?: React.ReactNode;
  kind?: "primary" | "secondary" | "ghost" | "danger" | "gold";
  size?: "sm" | "md" | "lg";
  icon?: string;
  iconR?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  full?: boolean;
  style?: React.CSSProperties;
  ariaLabel?: string;
  title?: string;
  type?: "button" | "submit" | "reset";
}

export const Btn: React.FC<BtnProps> = ({
  children,
  kind = "primary",
  size = "md",
  icon,
  iconR,
  onClick,
  disabled,
  full,
  style,
  ariaLabel,
  title,
  type = "button",
}) => {
  const [hovered, setHovered] = useState(false);

  const sizes = {
    sm: { p: "7px 12px", fs: 13, g: 6 },
    md: { p: "10px 16px", fs: 14, g: 8 },
    lg: { p: "14px 22px", fs: 16, g: 9 },
  };
  const s = sizes[size];

  const kinds = {
    primary: { background: "var(--primary)", color: "#fff", border: "1px solid var(--primary)" },
    secondary: { background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)" },
    ghost: { background: "transparent", color: "var(--ink-soft)", border: "1px solid transparent" },
    danger: { background: "transparent", color: "var(--disagree)", border: "1px solid var(--line)" },
    gold: { background: "var(--accent)", color: "#fff", border: "1px solid var(--accent)" },
  };

  const buttonStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: s.g,
    padding: s.p,
    fontSize: s.fs,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: 8,
    letterSpacing: 0.1,
    width: full ? "100%" : undefined,
    opacity: disabled ? 0.5 : 1,
    transition: "filter .15s, background .15s",
    filter: hovered && !disabled ? "brightness(0.95)" : "none",
    ...kinds[kind],
    ...style,
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      type={type}
      style={buttonStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {icon && <Ic name={icon} size={s.fs + 3} />}
      {children}
      {iconR && <Ic name={iconR} size={s.fs + 3} />}
    </button>
  );
};
