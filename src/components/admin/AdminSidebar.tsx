"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Ic } from "../ui/Icons";
import { useNarrow } from "@/components/ui/LayoutHelpers";

interface AdminSidebarProps {
  user: {
    name: string;
    email: string;
    unitId: string | null;
  };
  activePollId: string | null;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ user, activePollId }) => {
  const pathname = usePathname();
  const router = useRouter();
  const narrow = useNarrow(860);

  const pollLink = activePollId ? `/admin/poll/${activePollId}` : "/admin/poll/create";

  const nav = [
    { id: "dashboard", label: "Prehľad", icon: "dashboard", href: "/admin" },
    { id: "poll", label: "Aktívne hlasovanie", icon: "vote", href: pollLink },
    { id: "register", label: "Dom a vlastníci", icon: "building", href: "/admin/register" },
  ];

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/admin/login");
        router.refresh();
      }
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const getActiveTab = () => {
    if (pathname === "/admin") return "dashboard";
    if (pathname.startsWith("/admin/poll") || pathname.startsWith("/admin/poll/create")) return "poll";
    if (pathname.startsWith("/admin/register")) return "register";
    return "";
  };

  const active = getActiveTab();
  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .map((x) => x[0])
    .slice(-2)
    .join("")
    .toUpperCase() || "A";
  const roleLabel = user.unitId ? `Administrátor · byt č. ${user.unitId}` : "Administrátor";

  if (narrow) {
    return (
      <header
        style={{
          flexShrink: 0,
          background: "var(--sidebar)",
          color: "#E8ECF4",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 10px",
          overflowX: "auto",
        }}
      >
        {nav.map((n) => (
          <Link key={n.id} href={n.href} style={{ textDecoration: "none" }}>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                flexShrink: 0,
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: "nowrap",
                background: active === n.id ? "rgba(255,255,255,.12)" : "transparent",
                color: active === n.id ? "#fff" : "rgba(232,236,244,.72)",
              }}
            >
              <Ic name={n.icon} size={17} />
              {n.label}
            </button>
          </Link>
        ))}
        <button
          onClick={handleLogout}
          title="Odhlásiť sa"
          style={{
            marginLeft: "auto",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: "nowrap",
            background: "transparent",
            color: "rgba(232,236,244,.72)",
          }}
        >
          <Ic name="lock" size={16} /> Odhlásiť
        </button>
      </header>
    );
  }

  return (
    <aside
      style={{
        width: 248,
        flexShrink: 0,
        background: "var(--sidebar)",
        color: "#E8ECF4",
        display: "flex",
        flexDirection: "column",
        padding: "22px 16px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "2px 8px 22px" }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 9,
            background: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Ic name="scale" size={21} sw={2} style={{ color: "#fff" }} />
        </div>
        <div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 16, fontWeight: 600, lineHeight: 1.1 }}>
            Björnsonova 3
          </div>
          <div style={{ fontSize: 11, color: "rgba(232,236,244,.55)", letterSpacing: 0.3 }}>
            elektronické hlasovanie
          </div>
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {nav.map((n) => (
          <Link key={n.id} href={n.href} style={{ textDecoration: "none" }}>
            <button
              aria-current={active === n.id ? "page" : undefined}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "10px 12px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: active === n.id ? 600 : 500,
                textAlign: "left",
                background: active === n.id ? "rgba(255,255,255,.10)" : "transparent",
                color: active === n.id ? "#fff" : "rgba(232,236,244,.72)",
                transition: "background .15s",
              }}
            >
              <Ic name={n.icon} size={18} />
              {n.label}
            </button>
          </Link>
        ))}
      </nav>

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 8px",
            borderTop: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              background: "rgba(255,255,255,.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {initials}
          </div>
          <div style={{ lineHeight: 1.25, flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user.name}
            </div>
            <div style={{ fontSize: 11, color: "rgba(232,236,244,.5)" }}>{roleLabel}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Odhlásiť sa"
            aria-label="Odhlásiť sa"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(232,236,244,.6)",
              display: "flex",
              padding: 4,
            }}
          >
            <Ic name="lock" size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
};
