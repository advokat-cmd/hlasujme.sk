import React from "react";

interface IconProps {
  d: string | string[];
  size?: number;
  fill?: boolean;
  sw?: number;
  style?: React.CSSProperties;
}

const Icon: React.FC<IconProps> = ({ d, size = 20, fill = false, sw = 1.7, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill ? "currentColor" : "none"}
    stroke={fill ? "none" : "currentColor"}
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
    aria-hidden="true"
  >
    {Array.isArray(d) ? (
      d.map((p, i) => <path key={i} d={p} />)
    ) : (
      <path d={d} />
    )}
  </svg>
);

export const ICONS: Record<string, string | string[]> = {
  dashboard: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z",
  vote: ["M9 12l2 2 4-4", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"],
  building: [
    "M3 21h18",
    "M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16",
    "M15 21V9h2a2 2 0 0 1 2 2v10",
    "M8 7h2M8 11h2M8 15h2",
  ],
  archive: [
    "M3 7h18v3H3z",
    "M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9",
    "M9 14h6",
  ],
  bell: [
    "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9",
    "M13.7 21a2 2 0 0 1-3.4 0",
  ],
  alert: [
    "M12 9v4",
    "M12 17h.01",
    "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  ],
  check: "M20 6 9 17l-5-5",
  checkCircle: ["M22 11.1V12a10 10 0 1 1-5.9-9.1", "M22 4 12 14.01l-3-3"],
  x: "M18 6 6 18M6 6l12 12",
  xCircle: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M15 9l-6 6M9 9l6 6"],
  minus: "M5 12h14",
  clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M12 6v6l4 2"],
  mail: ["M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z", "m22 7-10 6L2 7"],
  link: [
    "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1",
    "M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  ],
  users: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    "M22 21v-2a4 4 0 0 0-3-3.9",
    "M16 3.1a4 4 0 0 1 0 7.8",
  ],
  user: [
    "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",
    "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  ],
  plus: "M12 5v14M5 12h14",
  chevR: "m9 18 6-6-6-6",
  chevL: "m15 18-6-6 6-6",
  chevD: "m6 9 6 6 6-6",
  doc: [
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
    "M14 2v6h6",
    "M9 13h6M9 17h6",
  ],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z", "m9 12 2 2 4-4"],
  scale: ["M12 3v18", "M7 7l-4 7h8z", "M17 7l4 7h-8z", "M5 21h14", "M7 7l5-2 5 2"],
  gavel: [
    "m14 13-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10",
    "m16 16 6-6",
    "m8 8 6-6",
    "m9 7 8 8",
    "m21 11-8-8",
  ],
  paper: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6"],
  send: ["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"],
  edit: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z", "m21 21-4.3-4.3"],
  lock: [
    "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z",
    "M8 11V7a4 4 0 0 1 8 0v4",
  ],
  eye: [
    "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z",
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  ],
  eyeOff: [
    "M9.9 5A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a13 13 0 0 1-2 2.7",
    "M6 6a13 13 0 0 0-4 6s3.5 7 10 7a9.7 9.7 0 0 0 4-.9",
    "M3 3l18 18",
  ],
  refresh: [
    "M3 12a9 9 0 0 1 15-6.7L21 8",
    "M21 3v5h-5",
    "M21 12a9 9 0 0 1-15 6.7L3 16",
    "M3 21v-5h5",
  ],
};

interface IcProps {
  name: string;
  size?: number;
  fill?: boolean;
  sw?: number;
  style?: React.CSSProperties;
}

export const Ic: React.FC<IcProps> = ({ name, size = 20, fill, sw, style }) => {
  const pathData = ICONS[name];
  if (!pathData) return null;
  return <Icon d={pathData} size={size} fill={fill} sw={sw} style={style} />;
};
