import React from "react";

interface ProgressSegment {
  value: number;
  color: string;
}

interface ProgressProps {
  value?: number;
  total: number;
  threshold?: number | null;
  height?: number;
  segments?: ProgressSegment[];
  label?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  total,
  threshold,
  height = 10,
  segments,
  label,
}) => {
  const pct = (v: number) => (total ? Math.min(100, (v / total) * 100) : 0);

  const getRunningTotal = () => {
    if (segments) {
      return segments.reduce((sum, s) => sum + (s.value || 0), 0);
    }
    return value || 0;
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total || 100}
        aria-valuenow={Math.round(getRunningTotal())}
        style={{
          height,
          borderRadius: 999,
          background: "var(--paper-2)",
          overflow: "hidden",
          display: "flex",
        }}
      >
        {segments
          ? segments.map((s, i) => (
              <div
                key={i}
                style={{
                  width: pct(s.value) + "%",
                  background: s.color,
                  transition: "width .4s",
                }}
              />
            ))
          : value !== undefined && (
              <div
                style={{
                  width: pct(value) + "%",
                  background: "var(--primary)",
                  transition: "width .4s",
                }}
              />
            )}
      </div>
      {threshold != null && total ? (
        <div
          style={{
            position: "absolute",
            top: -3,
            bottom: -3,
            left: `calc(${pct(threshold)}% - 1px)`,
            width: 2,
            background: "var(--ink)",
            borderRadius: 2,
          }}
          title="Potrebná väčšina"
        />
      ) : null}
    </div>
  );
};
