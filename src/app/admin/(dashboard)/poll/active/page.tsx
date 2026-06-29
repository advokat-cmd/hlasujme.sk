import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PollStatus } from "@prisma/client";
import { PageHead } from "@/components/admin/PageHead";
import { Card } from "@/components/ui/Card";
import { Btn } from "@/components/ui/Button";
import { Ic } from "@/components/ui/Icons";
import { Pill } from "@/components/ui/Pill";

import { getAdminSession } from "@/lib/session";

export const revalidate = 0;

export default async function ActivePollPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.role === "vlastnik") redirect("/admin");

  const building = await db.building.findFirst();
  if (!building) redirect("/admin");

  const activePolls = await db.poll.findMany({
    where: { 
      buildingId: building.id, 
      status: { in: [PollStatus.active, PollStatus.draft] } 
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="admin-page-container">
      <PageHead eyebrow={building.name} title="Hlasovania (aktívne)">
        <Link href="/admin/poll/create" style={{ textDecoration: "none" }}>
          <Btn kind="primary" icon="plus">Vytvoriť hlasovanie</Btn>
        </Link>
      </PageHead>

      <Card style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 12 }}>
          Prebiehajúce a plánované hlasovania
        </div>
        
        <div style={{ display: "flex", flexDirection: "column" }}>
          {activePolls.length > 0 ? (
            activePolls.map((a, i) => {
              const isActive = a.status === PollStatus.active;
              return (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "16px 0",
                    borderTop: i ? "1px solid var(--line)" : "none",
                    flexWrap: "wrap",
                  }}
                >
                  <Ic name="vote" size={20} style={{ color: isActive ? "var(--primary)" : "var(--ink-soft)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <Link href={`/admin/poll/${a.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                      <div
                        style={{
                          fontSize: "14.5px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {a.title}
                      </div>
                    </Link>
                    <div style={{ fontSize: "12px", color: "var(--ink-soft)", marginTop: 2 }}>
                      Trvanie: {a.startAt.toLocaleString("sk-SK")} – {a.endAt.toLocaleString("sk-SK")} · Vyhlásil: {a.declarer}
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    <Pill tone={isActive ? "success" : "neutral"} size="sm">
                      {isActive ? "prebieha" : "návrh"}
                    </Pill>
                    
                    <Link href={`/admin/poll/${a.id}`} style={{ textDecoration: "none" }}>
                      <Btn kind="secondary" size="sm" icon="eye">
                        Detail
                      </Btn>
                    </Link>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ padding: "40px 10px", textAlign: "center", color: "var(--ink-soft)" }}>
              <Ic name="vote" size={28} style={{ color: "var(--ink-faint)", marginBottom: 8, display: "block", margin: "0 auto" }} />
              Žiadne aktívne hlasovania.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
