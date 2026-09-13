import Link from "next/link";
import { db } from "@/lib/db";
import { pollStatusLabel } from "@/lib/pollPresentation";
import { PageHead } from "./PageHead";
import { Card } from "../ui/Card";

/** Owner overview deliberately never queries live votes, tallies, or other owners. */
export async function OwnerDashboard({ building }: { building: { id: string; name: string } }) {
  const polls = await db.poll.findMany({
    where: { buildingId: building.id, status: { in: ["active", "closing", "closed"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, status: true, startAt: true, endAt: true },
  });
  return <div className="admin-page-container">
    <PageHead eyebrow={building.name} title="Klientská zóna vlastníka" />
    <Card style={{ marginBottom: 20 }}>
      Hlasujete cez osobný odkaz v e-mailovej pozvánke. Výsledky sa tu sprístupnia až po uzavretí hlasovania administrátorom.
    </Card>
    <div style={{ display: "grid", gap: 16 }}>
      {polls.length === 0 && <Card>Zatiaľ nie je zverejnené žiadne hlasovanie.</Card>}
      {polls.map(poll => <Card key={poll.id}>
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>{poll.title}</h2>
        <p>{pollStatusLabel(poll.status, poll.startAt.toISOString(), poll.endAt.toISOString())}</p>
        <p>Termín: {poll.startAt.toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" })} – {poll.endAt.toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" })}</p>
        <Link href={`/admin/poll/${poll.id}`}>{poll.status === "closed" ? "Výsledky a zápisnica" : "Otázky a podklady"}</Link>
      </Card>)}
    </div>
  </div>;
}
