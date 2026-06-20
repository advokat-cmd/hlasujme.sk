"use client";

import React from "react";

interface IOSStatusBarProps {
  dark?: boolean;
  time?: string;
}

export const IOSStatusBar: React.FC<IOSStatusBarProps> = ({ dark = false, time = "9:41" }) => {
  const c = dark ? "#fff" : "#000";
  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        gap: 154,
        alignItems: "center",
        justifyContent: "center",
        padding: "21px 24px 19px",
        boxSizing: "border-box",
        position: "relative",
        zIndex: 20,
        width: "100%",
        userSelect: "none",
      }}
    >
      <div style={{ flex: 1, height: 22, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 1.5 }}>
        <span
          style={{
            fontFamily: '-apple-system, "SF Pro", system-ui',
            fontWeight: 590,
            fontSize: 17,
            lineHeight: "22px",
            color: c,
          }}
        >
          {time}
        </span>
      </div>
      <div style={{ flex: 1, height: 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, paddingTop: 1, paddingRight: 1 }}>
        <svg width="19" height="12" viewBox="0 0 19 12">
          <rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7" fill={c} />
          <rect x="4.8" y="5" width="3.2" height="7" rx="0.7" fill={c} />
          <rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7" fill={c} />
          <rect x="14.4" y="0" width="3.2" height="12" rx="0.7" fill={c} />
        </svg>
        <svg width="17" height="12" viewBox="0 0 17 12">
          <path
            d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z"
            fill={c}
          />
          <path
            d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z"
            fill={c}
          />
          <circle cx="8.5" cy="10.5" r="1.5" fill={c} />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke={c} strokeOpacity="0.35" fill="none" />
          <rect x="2" y="2" width="20" height="9" rx="2" fill={c} />
          <path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fill={c} fillOpacity="0.4" />
        </svg>
      </div>
    </div>
  );
};

interface IOSGlassPillProps {
  children: React.ReactNode;
  dark?: boolean;
  style?: React.CSSProperties;
}

export const IOSGlassPill: React.FC<IOSGlassPillProps> = ({ children, dark = false, style = {} }) => {
  return (
    <div
      style={{
        height: 44,
        minWidth: 44,
        borderRadius: 9999,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: dark
          ? "0 2px 6px rgba(0,0,0,0.35), 0 6px 16px rgba(0,0,0,0.2)"
          : "0 1px 3px rgba(0,0,0,0.07), 0 3px 10px rgba(0,0,0,0.06)",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 9999,
          backdropFilter: "blur(12px) saturate(180%)",
          WebkitBackdropFilter: "blur(12px) saturate(180%)",
          background: dark ? "rgba(120,120,128,0.28)" : "rgba(255,255,255,0.5)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 9999,
          boxShadow: dark
            ? "inset 1.5px 1.5px 1px rgba(255,255,255,0.15), inset -1px -1px 1px rgba(255,255,255,0.08)"
            : "inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)",
          border: dark ? "0.5px solid rgba(255,255,255,0.15)" : "0.5px solid rgba(0,0,0,0.06)",
        }}
      />
      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", padding: "0 4px" }}>
        {children}
      </div>
    </div>
  );
};

interface IOSNavBarProps {
  title?: string;
  dark?: boolean;
  trailingIcon?: boolean;
  onBack?: () => void;
}

export const IOSNavBar: React.FC<IOSNavBarProps> = ({ title = "Title", dark = false, trailingIcon = true, onBack }) => {
  const muted = dark ? "rgba(255,255,255,0.6)" : "#404040";
  const text = dark ? "#fff" : "#000";
  const pillIcon = (content: React.ReactNode, onClick?: () => void) => (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: onClick ? "pointer" : "default",
        outline: "none",
      }}
    >
      <IOSGlassPill dark={dark}>
        <div style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {content}
        </div>
      </IOSGlassPill>
    </button>
  );
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        paddingTop: 62,
        paddingBottom: 10,
        position: "relative",
        zIndex: 5,
        userSelect: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
        }}
      >
        {pillIcon(
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" style={{ marginLeft: -1 }}>
            <path d="M10 2L2 10l8 8" stroke={muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>,
          onBack
        )}
        {trailingIcon &&
          pillIcon(
            <svg width="22" height="6" viewBox="0 0 22 6">
              <circle cx="3" cy="3" r="2.5" fill={muted} />
              <circle cx="11" cy="3" r="2.5" fill={muted} />
              <circle cx="19" cy="3" r="2.5" fill={muted} />
            </svg>
          )}
      </div>
      <div
        style={{
          padding: "0 16px",
          fontFamily: "-apple-system, system-ui",
          fontSize: 34,
          fontWeight: 700,
          lineHeight: "41px",
          color: text,
          letterSpacing: 0.4,
        }}
      >
        {title}
      </div>
    </div>
  );
};

interface IOSKeyboardProps {
  dark?: boolean;
}

export const IOSKeyboard: React.FC<IOSKeyboardProps> = ({ dark = false }) => {
  const glyph = dark ? "rgba(255,255,255,0.7)" : "#595959";
  const sugg = dark ? "rgba(255,255,255,0.6)" : "#333";
  const keyBg = dark ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.85)";

  const icons = {
    shift: (
      <svg width="19" height="17" viewBox="0 0 19 17">
        <path d="M9.5 1L1 9.5h4.5V16h8V9.5H18L9.5 1z" fill={glyph} />
      </svg>
    ),
    del: (
      <svg width="23" height="17" viewBox="0 0 23 17">
        <path
          d="M7 1h13a2 2 0 012 2v11a2 2 0 01-2 2H7l-6-7.5L7 1z"
          fill="none"
          stroke={glyph}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M10 5l7 7M17 5l-7 7" stroke={glyph} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
    ret: (
      <svg width="20" height="14" viewBox="0 0 20 14">
        <path d="M18 1v6H4m0 0l4-4M4 7l4 4" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };

  const renderKey = (content: React.ReactNode, options: { w?: number; flex?: boolean; ret?: boolean; fs?: number; k: string }) => (
    <div
      key={options.k}
      style={{
        height: 42,
        borderRadius: 8.5,
        flex: options.flex ? 1 : undefined,
        width: options.w,
        minWidth: 0,
        background: options.ret ? "#08f" : keyBg,
        boxShadow: "0 1px 0 rgba(0,0,0,0.075)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: '-apple-system, "SF Compact", system-ui',
        fontSize: options.fs ?? 25,
        fontWeight: 458,
        color: options.ret ? "#fff" : glyph,
        userSelect: "none",
      }}
    >
      {content}
    </div>
  );

  const renderRow = (keys: string[], pad = 0) => (
    <div style={{ display: "flex", gap: 6.5, justifyContent: "center", padding: `0 ${pad}px` }}>
      {keys.map((l) => renderKey(l, { flex: true, k: l }))}
    </div>
  );

  return (
    <div
      style={{
        position: "relative",
        zIndex: 15,
        borderRadius: 27,
        overflow: "hidden",
        padding: "11px 0 2px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        boxShadow: dark
          ? "0 -2px 20px rgba(0,0,0,0.09)"
          : "0 -1px 6px rgba(0,0,0,0.018), 0 -3px 20px rgba(0,0,0,0.012)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 27,
          backdropFilter: "blur(12px) saturate(180%)",
          WebkitBackdropFilter: "blur(12px) saturate(180%)",
          background: dark ? "rgba(120,120,128,0.14)" : "rgba(255,255,255,0.25)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 27,
          boxShadow: dark
            ? "inset 1.5px 1.5px 1px rgba(255,255,255,0.15)"
            : "inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)",
          border: dark ? "0.5px solid rgba(255,255,255,0.15)" : "0.5px solid rgba(0,0,0,0.06)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          display: "flex",
          gap: 20,
          alignItems: "center",
          padding: "8px 22px 13px",
          width: "100%",
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        {['"The"', "the", "to"].map((w, i) => (
          <React.Fragment key={i}>
            {i > 0 && <div style={{ width: 1, height: 25, background: "#ccc", opacity: 0.3 }} />}
            <div
              style={{
                flex: 1,
                textAlign: "center",
                fontFamily: "-apple-system, system-ui",
                fontSize: 17,
                color: sugg,
                letterSpacing: -0.43,
                lineHeight: "22px",
              }}
            >
              {w}
            </div>
          </React.Fragment>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 13,
          padding: "0 6.5px",
          width: "100%",
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        {renderRow(["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"])}
        {renderRow(["a", "s", "d", "f", "g", "h", "j", "k", "l"], 20)}
        <div style={{ display: "flex", gap: 14.25, alignItems: "center" }}>
          {renderKey(icons.shift, { w: 45, k: "shift" })}
          <div style={{ display: "flex", gap: 6.5, flex: 1 }}>
            {["z", "x", "c", "v", "b", "n", "m"].map((l) => renderKey(l, { flex: true, k: l }))}
          </div>
          {renderKey(icons.del, { w: 45, k: "del" })}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {renderKey("ABC", { w: 92.25, fs: 18, k: "abc" })}
          {renderKey("", { flex: true, k: "space" })}
          {renderKey(icons.ret, { w: 92.25, ret: true, k: "ret" })}
        </div>
      </div>

      <div style={{ height: 56, width: "100%", position: "relative" }} />
    </div>
  );
};

interface IOSDeviceProps {
  children: React.ReactNode;
  width?: number;
  height?: number;
  dark?: boolean;
  title?: string;
  keyboard?: boolean;
  onBack?: () => void;
}

export const IOSDevice: React.FC<IOSDeviceProps> = ({
  children,
  width = 402,
  height = 874,
  dark = false,
  title,
  keyboard = false,
  onBack,
}) => {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 48,
        overflow: "hidden",
        position: "relative",
        background: dark ? "#000" : "#F2F2F7",
        boxShadow: "0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)",
        fontFamily: '-apple-system, system-ui, sans-serif',
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 11,
          left: "50%",
          transform: "translateX(-50%)",
          width: 126,
          height: 37,
          borderRadius: 24,
          background: "#000",
          zIndex: 50,
        }}
      />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}>
        <IOSStatusBar dark={dark} />
      </div>
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {title !== undefined && <IOSNavBar title={title} dark={dark} onBack={onBack} />}
        <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
        {keyboard && <IOSKeyboard dark={dark} />}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          height: 34,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          paddingBottom: 8,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: 139,
            height: 5,
            borderRadius: 100,
            background: dark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.25)",
          }}
        />
      </div>
    </div>
  );
};
