import assert from "node:assert/strict";
import test from "node:test";
import {
  POLL_CLOSURE_NOTIFICATION_EMAIL,
  renderPollClosureNotification,
} from "../src/lib/pollClosureNotification";
import type { SealedPollSnapshot } from "../src/lib/seal";

const snapshot: SealedPollSnapshot = {
  version: 1,
  sealedAt: "2026-09-21T10:15:00.000Z",
  poll: {
    id: "poll-123",
    title: "Oprava <strechy> & fasády",
    reason: "Test",
    declarer: "Správca",
    announcedAt: "2026-09-01T08:00:00.000Z",
    startAt: "2026-09-10T08:00:00.000Z",
    endAt: "2026-09-20T18:00:00.000Z",
    building: {
      id: "building-123",
      name: "Dom <A>",
      short: "Dom <A>",
      address: "Björnsonova 3, Bratislava",
      entrance: "3",
      manager: "Správca",
      contact: "Milan",
      contactEmail: "milan@example.test",
    },
  },
  questions: [
    {
      id: "question-1",
      no: 1,
      kind: "yes-no",
      title: "Súhlasíte s opravou?",
      text: "Súhlasíte s opravou?",
      majorityType: "half-all",
      note: null,
      attachments: [],
      tally: { total: 10, agree: 6, disagree: 2, abstain: 1, none: 1, disputed: 0, voted: 9, need: 6, status: "approved" },
    },
    {
      id: "question-2",
      no: 2,
      kind: "yes-no",
      title: "Súhlasíte s náterom?",
      text: "Súhlasíte s náterom?",
      majorityType: "half-all",
      note: null,
      attachments: [],
      tally: { total: 10, agree: 4, disagree: 4, abstain: 0, none: 2, disputed: 1, voted: 8, need: 6, status: "rejected" },
    },
  ],
  units: [],
};

test("closure notification is addressed only to Milan and contains results with an admin link", () => {
  const adminLink = "https://hlasujme.sk/admin/poll/poll-123?tab=results";
  const message = renderPollClosureNotification(snapshot, adminLink);

  assert.equal(POLL_CLOSURE_NOTIFICATION_EMAIL, "milan@ficek.sk");
  assert.equal(message.subject, "Hlasovanie uzavreté: Oprava <strechy> & fasády");
  assert.match(message.html, /Hlasovanie bolo uzavreté/);
  assert.match(message.html, /Schválené/);
  assert.match(message.html, /Neschválené/);
  assert.match(message.html, /ZA: <strong>6<\/strong>/);
  assert.match(message.html, /Účasť: <strong>9 z 10/);
  assert.match(message.html, new RegExp(adminLink.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(message.html, /Vlastníkom nebola automaticky odoslaná zápisnica ani výsledky/);
});

test("closure notification escapes stored text and contains no public protocol or PDF link", () => {
  const message = renderPollClosureNotification(snapshot, "https://hlasujme.sk/admin/poll/poll-123?tab=results");

  assert.match(message.html, /Oprava &lt;strechy&gt; &amp; fasády/);
  assert.match(message.html, /Dom &lt;A&gt;/);
  assert.doesNotMatch(message.html, /Oprava <strechy>/);
  assert.doesNotMatch(message.html, /\/api\/sealed\//);
  assert.doesNotMatch(message.html, /\.pdf(?:[?"'])/i);
});
