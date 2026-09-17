type AlertUnit = { id: string; no: string };

type PartialOwner = {
  name: string;
  units: AlertUnit[];
};

export type PollConflictAlertSource = {
  pollId: string;
  pollTitle: string;
  disputedUnits: AlertUnit[];
  partialOwners: PartialOwner[];
};

export type DashboardAlert = {
  icon: "alert" | "user";
  tone: "accent" | "primary";
  text: string;
  cta: string;
  href: string;
};

export function buildPollConflictAlerts(sources: PollConflictAlertSource[]): DashboardAlert[] {
  return sources.flatMap(source => {
    const href = `/admin/poll/${source.pollId}?tab=units`;
    return [
      ...source.disputedUnits.map(unit => ({
        icon: "alert" as const,
        tone: "accent" as const,
        text: `Hlasovanie „${source.pollTitle}“: Byt č. ${unit.no} — spoluvlastníci hlasovali rozdielne a žiadny nemá väčšinu podielov. Hlas je sporný.`,
        cta: "Riešiť",
        href,
      })),
      ...source.partialOwners.map(owner => ({
        icon: "user" as const,
        tone: "primary" as const,
        text: `Hlasovanie „${source.pollTitle}“: ${owner.name} vlastní viac jednotiek (${owner.units.map(unit => `č. ${unit.no}`).join(", ")}) a zatiaľ nehlasoval za všetky.`,
        cta: "Zobraziť",
        href,
      })),
    ];
  });
}
