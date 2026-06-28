import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PollStatus } from "@prisma/client";
import { PageHead } from "@/components/admin/PageHead";
import { Card } from "@/components/ui/Card";
import { Btn } from "@/components/ui/Button";
import { Ic } from "@/components/ui/Icons";

export const revalidate = 0;

export default async function ActivePollPage() {
  const building = await db.building.findFirst();
  if (!building) redirect("/admin");

  const activePoll = await db.poll.findFirst({
    where: { buildingId: building.id, status: PollStatus.active },
  });

  if (activePoll) {
    redirect(`/admin/poll/${activePoll.id}`);
  }

  return (
    <div className="admin-page-container">
      <PageHead eyebrow={building.name} title="Hlasovania (aktívne)">
        <Link href="/admin/poll/create" style={{ textDecoration: "none" }}>
          <Btn kind="primary" icon="plus">Vytvoriť hlasovanie</Btn>
        </Link>
      </PageHead>

      <Card style={{ padding: "48px 32px", textAlign: "center", marginTop: 10 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            background: "var(--paper-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 18px",
          }}
        >
          <Ic name="vote" size={24} style={{ color: "var(--ink-soft)" }} />
        </div>
        <h3 style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>
          Aktívne hlasovanie neprebieha
        </h3>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 24px", maxWidth: 400, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
          Momentálne nie je otvorené žiadne elektronické hlasovanie vlastníkov. Nové hlasovanie môžete spustiť ihneď kliknutím na tlačidlo nižšie.
        </p>
        <Link href="/admin/poll/create" style={{ textDecoration: "none" }}>
          <Btn kind="primary" icon="plus">Vytvoriť hlasovanie</Btn>
        </Link>
      </Card>
    </div>
  );
}
