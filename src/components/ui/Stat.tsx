import React from "react";
import { Ic } from "./Icons";

interface StatProps {
  label: string;
  value: string | number;
  sub?: string;
  tone?: string;
  icon?: string;
}

export const Stat: React.FC<StatProps> = ({ label, value, sub, tone, icon }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          color: "var(--ink-faint)",
          fontSize: "12.5px",
          fontWeight: 600,
          letterSpacing: 0.3,
          textTransform: "uppercase",
        }}
      >
        {icon && <Ic name={icon} size={14} />}
        {label}
      </div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          color: tone || "var(--ink)",
          fontVariantNumeric: "tabular-nums",
          fontFamily: "var(--serif)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: "12.5px", color: "var(--ink-soft)" }}>{sub}</div>}
    </div>
  );
};
