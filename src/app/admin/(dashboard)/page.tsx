import React from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { PollStatus, VoteAnswer, MajorityType } from "@prisma/client";
import { getEffectiveUnitVote, tallyQuestion } from "@/lib/engine";
import { PageHead } from "@/components/admin/PageHead";
import { Card } from "@/components/ui/Card";
import { Btn } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Stat } from "@/components/ui/Stat";
import { Progress } from "@/components/ui/Progress";
import { Ic } from "@/components/ui/Icons";

export const revalidate = 0; // Disable server caching for real-time dashboard data

export default async function AdminDashboard() {
  // 1. Fetch building details (default to first seeded building)
  const building = await db.building.findFirst();
  if (!building) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Chyba: V databáze nie je nastavený žiadny bytový dom. Spustite seed skript.</h2>
      </div>
    );
  }

  // 2. Fetch basic counts
  const totalEligible = await db.unit.count({ where: { status: "active", buildingId: building.id } });
  const sumVotesResult = await db.unit.aggregate({
    where: { status: "active", buildingId: building.id },
    _sum: { votes: true }
  });
  const eligibleVotes = sumVotesResult._sum.votes || 0;

  // 3. Fetch active poll
  const activePoll = await db.poll.findFirst({
    where: { buildingId: building.id, status: PollStatus.active },
    include: { questions: { orderBy: { no: "asc" } } }
  });

  // 4. Calculate turnout & disputed units for active poll
  let votedUnits = 0;
  let turnout = 0;
  let disputedUnitsCount = 0;
  const disputedUnitsList: any[] = [];
  const partialOwnersList: any[] = [];
  const activePollQuestionsTallies: any[] = [];

  const activeUnits = await db.unit.findMany({
    where: { buildingId: building.id, status: "active" },
    include: { owners: true }
  });

  const missingEmailUnits = activeUnits.filter(u => !u.email);

  if (activePoll) {
    // Fetch all votes & subvotes to determine who voted
    const votes = await db.vote.findMany({ where: { pollId: activePoll.id } });
    const subvotes = await db.coownerSubvote.findMany({ where: { pollId: activePoll.id } });

    const votedUnitIds = new Set([
      ...votes.map(v => v.unitId),
      ...subvotes.map(sv => sv.unitId)
    ]);
    votedUnits = votedUnitIds.size;
    turnout = totalEligible > 0 ? Math.round((votedUnits / totalEligible) * 100) : 0;

    // Check which units are disputed on ANY question
    for (const u of activeUnits) {
      let isDisputed = false;
      for (const q of activePoll.questions) {
        const eff = await getEffectiveUnitVote(activePoll.id, u.id, q.no);
        if (eff.disputed) {
          isDisputed = true;
          break;
        }
      }
      if (isDisputed) {
        disputedUnitsList.push(u);
      }
    }
    disputedUnitsCount = disputedUnitsList.length;

    // Check for owners owning multiple units who haven't voted for all
    const ownerUnitsMap: Record<string, { name: string; units: typeof activeUnits }> = {};
    activeUnits.forEach(u => {
      u.owners.forEach(o => {
        const emailKey = (o.email || u.email || "").trim().toLowerCase();
        if (emailKey) {
          if (!ownerUnitsMap[emailKey]) {
            ownerUnitsMap[emailKey] = { name: o.name, units: [] };
          }
          ownerUnitsMap[emailKey].units.push(u);
        }
      });
    });

    Object.values(ownerUnitsMap).forEach(group => {
      if (group.units.length > 1) {
        const hasVotedSome = group.units.some(u => votedUnitIds.has(u.id));
        const hasNotVotedSome = group.units.some(u => !votedUnitIds.has(u.id));
        if (hasVotedSome && hasNotVotedSome) {
          partialOwnersList.push({
            name: group.name,
            units: group.units
          });
        }
      }
    });

    // Compute tallies for each active poll question
    for (const q of activePoll.questions) {
      const tally = await tallyQuestion(activePoll.id, q.id);
      activePollQuestionsTallies.push({
        no: q.no,
        title: q.title,
        agree: tally.agree,
        disagree: tally.disagree,
        abstain: tally.abstain,
        need: tally.need,
        total: tally.total,
        status: tally.status
      });
    }
  }

  // 5. Fetch archived polls
  const archivedPolls = await db.poll.findMany({
    where: { buildingId: building.id, status: PollStatus.closed },
    orderBy: { endAt: "desc" },
    include: { sealedResult: true },
    take: 4
  });

  // 6. Generate Alerts
  const alerts: any[] = [];
  
  disputedUnitsList.forEach(u => {
    alerts.push({
      icon: "alert",
      tone: "accent",
      text: `Byt č. ${u.no} — spoluvlastníci hlasovali rozdielne a žiadny nemá väčšinu podielov. Hlas je sporný.`,
      cta: "Riešiť",
      href: `/admin/poll/${activePoll?.id}?tab=units`
    });
  });

  missingEmailUnits.forEach(u => {
    alerts.push({
      icon: "mail",
      tone: "danger",
      text: `Byt č. ${u.no} — vlastník nemá zadanú e-mailovú adresu, pozvánka nebola doručená.`,
      cta: "Doplniť",
      href: `/admin/register?editUnit=${u.id}`
    });
  });

  partialOwnersList.forEach(p => {
    alerts.push({
      icon: "user",
      tone: "primary",
      text: `${p.name} vlastní viac jednotiek (${p.units.map((u: any) => "č. " + u.no).join(", ")}) a zatiaľ nehlasoval za všetky.`,
      cta: "Zobraziť",
      href: `/admin/poll/${activePoll?.id}?tab=units`
    });
  });

  const formattedEnd = activePoll 
    ? activePoll.endAt.toLocaleString("sk-SK", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) 
    : "";

  return (
    <div className="admin-page-container">
      <PageHead eyebrow={building.name} title="Prehľad">
        <Link href="/admin/register" style={{ textDecoration: "none" }}>
          <Btn kind="secondary" icon="users">Vlastníci</Btn>
        </Link>
        <Link href="/admin/poll/create" style={{ textDecoration: "none" }}>
          <Btn kind="primary" icon="plus">Nové hlasovanie</Btn>
        </Link>
      </PageHead>

      {/* Active poll banner */}
      {activePoll ? (
        <Card pad={0} style={{ overflow: "hidden", marginBottom: 28 }}>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 380px", padding: "26px 28px", borderRight: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <Pill tone="success" icon="vote" size="sm">Prebieha</Pill>
                <span style={{ fontSize: "12.5px", color: "var(--ink-soft)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Ic name="clock" size={14} /> do {formattedEnd}
                </span>
              </div>
              <h2 style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 600, margin: "0 0 6px" }}>
                {activePoll.title}
              </h2>
              <p style={{ fontSize: "13.5px", color: "var(--ink-soft)", margin: "0 0 18px", maxWidth: 440, lineHeight: 1.5 }}>
                {activePoll.reason} · {activePoll.questions.length} otázky · vyhlásil {activePoll.declarer}
              </p>
              
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 7 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Účasť</span>
                <span style={{ fontSize: 13, color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums" }}>
                  {votedUnits} / {totalEligible} jednotiek
                </span>
                <span style={{ marginLeft: "auto", fontFamily: "var(--serif)", fontSize: 20, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {turnout} %
                </span>
              </div>
              <Progress value={votedUnits} total={totalEligible} />
              
              <div style={{ marginTop: 20 }}>
                <Link href={`/admin/poll/${activePoll.id}`} style={{ textDecoration: "none" }}>
                  <Btn kind="primary" iconR="chevR">Otvoriť hlasovanie</Btn>
                </Link>
              </div>
            </div>
            
            <div
              style={{
                flex: "1 1 260px",
                padding: "26px 28px",
                background: "var(--paper-2)",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "24px 18px",
                alignContent: "start",
              }}
            >
              <Stat label="Oprávnené hlasy" value={eligibleVotes} icon="building" />
              <Stat label="Prijaté hlasy" value={votedUnits} icon="checkCircle" tone="var(--agree)" />
              <Stat label="Sporné byty" value={disputedUnitsCount} icon="alert" tone={disputedUnitsCount ? "var(--accent-ink)" : undefined} />
              <Stat label="Chybné e-maily" value={missingEmailUnits.length} icon="mail" tone={missingEmailUnits.length ? "var(--disagree)" : undefined} />
            </div>
          </div>
        </Card>
      ) : (
        <Card style={{ padding: "40px", textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 50, height: 50, borderRadius: 25, background: "var(--paper-2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 15px" }}>
            <Ic name="vote" size={24} style={{ color: "var(--ink-soft)" }} />
          </div>
          <h3 style={{ fontFamily: "var(--serif)", fontSize: 19, margin: "0 0 6px" }}>Žiadne prebiehajúce hlasovanie</h3>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 20px" }}>Aktuálne neprebieha žiadne elektronické hlasovanie vlastníkov.</p>
          <Link href="/admin/poll/create" style={{ textDecoration: "none" }}>
            <Btn kind="primary" icon="plus">Vytvoriť nové hlasovanie</Btn>
          </Link>
        </Card>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 30 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>Kontrola konfliktov</div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 2 }}>Veci, ktoré si pred uzavretím vyžadujú vašu pozornosť</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {alerts.map((a, i) => (
              <Card key={i} pad={0} hover>
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px" }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: `var(--${a.tone}-bg)`,
                      color: `var(--${a.tone === "accent" ? "accent-ink" : a.tone})`,
                    }}
                  >
                    <Ic name={a.icon} size={18} />
                  </div>
                  <div style={{ flex: 1, fontSize: "13.5px", color: "var(--ink)", lineHeight: 1.45 }}>{a.text}</div>
                  <Link href={a.href} style={{ textDecoration: "none" }}>
                    <Btn kind="secondary" size="sm">{a.cta}</Btn>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick question status & recent */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20 }}>
        {activePoll && (
          <Card>
            <div style={{ fontFamily: "var(--serif)", fontSize: 19, fontWeight: 600, color: "var(--ink)", marginBottom: 16 }}>
              Stav otázok
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {activePollQuestionsTallies.map((q) => {
                const toneMap = {
                  approved: "success",
                  rejected: "danger",
                  short: "accent"
                };
                const labelMap = {
                  approved: "Schválené",
                  rejected: "Neschválené",
                  short: "Zatiaľ nedosiahnutá väčšina"
                };
                const iconMap = {
                  approved: "checkCircle",
                  rejected: "xCircle",
                  short: "clock"
                };
                const currentStatus = q.status as "approved" | "rejected" | "short";

                return (
                  <div key={q.no}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-faint)" }}>{q.no}.</span>
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {q.title}
                      </span>
                      <Pill tone={toneMap[currentStatus] as any} size="sm" icon={iconMap[currentStatus]}>
                        {labelMap[currentStatus]}
                      </Pill>
                    </div>
                    <Progress
                      height={7}
                      total={q.total}
                      threshold={q.need}
                      segments={[
                        { value: q.agree, color: "var(--agree)" },
                        { value: q.disagree, color: "var(--disagree)" },
                      ]}
                    />
                    <div style={{ fontSize: "11.5px", color: "var(--ink-soft)", marginTop: 5, fontVariantNumeric: "tabular-nums" }}>
                      {q.agree} za · {q.disagree} proti · potrebných {q.need} z {q.total}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <Card>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>Posledné hlasovania</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {archivedPolls.length > 0 ? (
              archivedPolls.map((a, i) => {
                const resultText = a.sealedResult 
                  ? JSON.parse(a.sealedResult.resultJson).status || "closed"
                  : "closed";
                const isApproved = resultText === "schválené" || resultText === "Schválené";
                
                // Parse seed turnout mock data
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
                      padding: "12px 0",
                      borderTop: i ? "1px solid var(--line)" : "none",
                    }}
                  >
                    <Ic name="paper" size={18} style={{ color: "var(--ink-faint)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "13.5px",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {a.title}
                      </div>
                      <div style={{ fontSize: "11.5px", color: "var(--ink-soft)" }}>
                        Ukončené {a.endAt.toLocaleDateString("sk-SK")} · účasť {turnoutText}
                      </div>
                    </div>
                    
                    <Pill tone={isApproved ? "success" : "danger"} size="sm">
                      {isApproved ? "schválené" : "neschválené"}
                    </Pill>
                    
                    <a href={`/api/sealed/${a.id}/pdf`} style={{ textDecoration: "none" }}>
                      <Btn kind="ghost" size="sm" icon="download" title="Stiahnuť PDF zápisnicu" />
                    </a>
                  </div>
                );
              })
            ) : (
              <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "20px 0", textAlign: "center" }}>
                Žiadne ukončené hlasovania v archíve.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
