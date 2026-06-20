import React from "react";

export const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 12px",
  borderRadius: 9,
  border: "1px solid var(--line)",
  fontFamily: "inherit",
  fontSize: "13.5px",
  background: "var(--paper)",
  color: "var(--ink)",
};

interface FormRowProps {
  label: string;
  children: React.ReactNode;
  hint?: string | React.ReactNode;
}

export const FormRow: React.FC<FormRowProps> = ({ label, children, hint }) => (
  <div style={{ display: "block", marginBottom: 14 }}>
    <div style={{ fontSize: "12.5px", fontWeight: 600, marginBottom: 5 }}>{label}</div>
    {children}
    {hint && <div style={{ fontSize: "11px", color: "var(--ink-soft)", marginTop: 4 }}>{hint}</div>}
  </div>
);

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input: React.FC<InputProps> = ({ style, ...props }) => (
  <input {...props} style={{ ...inputStyle, ...style }} />
);
