import React from "react";

interface PageHeadProps {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}

export const PageHead: React.FC<PageHeadProps> = ({ eyebrow, title, children }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 30,
      }}
    >
      <div>
        {eyebrow && (
          <div
            style={{
              fontSize: "12.5px",
              fontWeight: 600,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              color: "var(--accent-ink)",
              marginBottom: 7,
            }}
          >
            {eyebrow}
          </div>
        )}
        <h1 style={{ fontFamily: "var(--serif)", fontSize: 30, fontWeight: 600, margin: 0, letterSpacing: -0.3 }}>
          {title}
        </h1>
      </div>
      <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>{children}</div>
    </div>
  );
};
