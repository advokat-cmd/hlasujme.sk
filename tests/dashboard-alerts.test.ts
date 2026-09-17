import assert from "node:assert/strict";
import test from "node:test";
import { buildPollConflictAlerts } from "../src/lib/dashboardAlerts";

test("dashboard conflict alerts link to the poll that produced each conflict", () => {
  const alerts = buildPollConflictAlerts([
    {
      pollId: "poll-first",
      pollTitle: "Oprava strechy",
      disputedUnits: [{ id: "unit-1", no: "1" }],
      partialOwners: [{ name: "Anna Prvá", units: [{ id: "unit-1", no: "1" }, { id: "unit-2", no: "2" }] }],
    },
    {
      pollId: "poll-second",
      pollTitle: "Obnova výťahu",
      disputedUnits: [{ id: "unit-3", no: "3" }],
      partialOwners: [{ name: "Boris Druhý", units: [{ id: "unit-3", no: "3" }, { id: "unit-4", no: "4" }] }],
    },
  ]);

  assert.deepEqual(alerts.map(alert => alert.href), [
    "/admin/poll/poll-first?tab=units",
    "/admin/poll/poll-first?tab=units",
    "/admin/poll/poll-second?tab=units",
    "/admin/poll/poll-second?tab=units",
  ]);
  assert.match(alerts[0].text, /^Hlasovanie „Oprava strechy“: Byt č\. 1/);
  assert.match(alerts[1].text, /^Hlasovanie „Oprava strechy“: Anna Prvá/);
  assert.match(alerts[2].text, /^Hlasovanie „Obnova výťahu“: Byt č\. 3/);
  assert.match(alerts[3].text, /^Hlasovanie „Obnova výťahu“: Boris Druhý/);
});
