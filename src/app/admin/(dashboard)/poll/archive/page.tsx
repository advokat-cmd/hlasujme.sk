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

export const revalidate = 0;

export default async function ArchivePollPage() {
  const building = await db.building.findFirst();
  if (!building) redirect("/admin");

  const archivedPolls = await db.poll.findMany({
    where: { buildingId: building.id, status: PollStatus.closed },
    orderBy: { endAt: "desc" },
    include: { sealedResult: true },
  });

  return (
    <div className="admin-page-container">
      <PageHead eyebrow={building.name} title="Hlasovania (archív)">
        <Link href="/admin/poll/create" style={{ textDecoration: "none" }}>
          <Btn kind="primary" icon="plus">Vytvoriť hlasovanie</Btn>
        </Link>
      </PageHead>

      <Card style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 12 }}>
          História ukončených hlasovaní
        </div>
        
        <div style={{ display: "flex", flexDirection: "column" }}>
          {archivedPolls.length > 0 ? (
            archivedPolls.map((a, i) => {
              const resultText = a.sealedResult 
                ? JSON.parse(a.sealedResult.resultJson).status || "closed"
                : "closed";
              const isApproved = resultText === "schválené" || resultText === "Schválené";
              
              const turnoutText = a.sealedResult
                ? JSON.parse(a.sealedResult.resultJson).turnout || "—"
                : "—";

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
                  <Ic name="archive" size={20} style={{ color: "var(--ink-faint)", flexShrink: 0 }} />
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
                      Trvanie: {a.startAt.toLocaleDateString("sk-SK")} – {a.endAt.toLocaleDateString("sk-SK")} · Vyhlásil: {a.declarer} · Účasť: {turnoutText}
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    <Pill tone={isApproved ? "success" : "danger"} size="sm">
                      {isApproved ? "schválené" : "neschválené"}
                    </Pill>
                    
                    <a href={`/api/sealed/${a.id}/pdf`} style={{ textDecoration: "none" }}>
                      <Btn kind="secondary" size="sm" icon="download">
                        Zápisnica
                      </Btn>
                    </a>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ padding: "40px 10px", textAlign: "center", color: "var(--ink-soft)" }}>
              <Ic name="archive" size={28} style={{ color: "var(--ink-faint)", marginBottom: 8, display: "block", margin: "0 auto" }} />
              Žiadne ukončené hlasovania v archíve.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
