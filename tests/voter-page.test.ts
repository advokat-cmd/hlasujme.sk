import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { ComponentProps } from "react";
import { db } from "../src/lib/db";
import VoterPage from "../src/app/hlasuj/[token]/page";
import { VoterAppClient } from "../src/app/hlasuj/[token]/VoterAppClient";

function stubMethod<T extends object, K extends keyof T>(t: TestContext, target: T, key: K, implementation: (...args: never[]) => unknown) {
  const original = target[key];
  const stub = t.mock.fn(implementation);
  target[key] = stub as T[K];
  t.after(() => { target[key] = original; });
  return stub;
}

interface SubmissionToken {
  id: string;
  pollId: string;
  unitId: string;
  ownerId: string | null;
  usedAt: Date | null;
}

function fixture(t: TestContext, tokens: SubmissionToken[], ownerId: string | null = null) {
  let selected = tokens[0];
  const question = { id: "q1", no: 1, kind: "General", title: "Question", text: "Approve?", attachments: [] };
  const building = { id: "building", name: "Test building", address: "Test address", short: null };
  const poll = { id: "poll", buildingId: building.id, status: "active", title: "Test poll", reason: "Test", declarer: "Test",
    startAt: new Date(Date.now() - 60000), endAt: new Date(Date.now() + 60000), building, questions: [question] };
  const unit = { id: "unit", no: "1", buildingId: building.id, status: "active", votes: 1, coMode: ownerId ? "internal" : "single", email: null, actingPerson: null,
    owners: ["owner-a", "owner-b"].map(id => ({ id, first: "Test", last: id, name: `Test ${id}`, role: "coowner", share: 0.5 })) };
  stubMethod(t, db.voteToken, "findUnique", async () => ({ ...selected, poll, unit, expiresAt: poll.endAt }));
  stubMethod(t, db.building, "findUnique", async () => building);
  stubMethod(t, db.pollDocument, "findMany", async () => []);
  // These rows could be either final versions or legacy unconfirmed autosaves.
  const rows = [{ questionNo: 1, answer: "disagree", version: 2, createdAt: new Date() }, { questionNo: 1, answer: "agree", version: 1, createdAt: new Date() }];
  stubMethod(t, db.vote, "findMany", async () => rows);
  stubMethod(t, db.coownerSubvote, "findMany", async () => rows);
  const lookup = stubMethod(t, db.voteToken, "findFirst", async (query: {
    where: { pollId: string; unitId: string; ownerId: string | null; usedAt: { not: null } };
    orderBy: { usedAt: string };
  }) => {
    assert.deepEqual(query.where, { pollId: poll.id, unitId: unit.id, ownerId, usedAt: { not: null } });
    assert.deepEqual(query.orderBy, { usedAt: "desc" });
    const candidates = tokens.filter(token => token.pollId === query.where.pollId && token.unitId === query.where.unitId
      && token.ownerId === query.where.ownerId && token.usedAt !== null).sort((a, b) => b.usedAt!.getTime() - a.usedAt!.getTime());
    return candidates[0] ? { usedAt: candidates[0].usedAt } : null;
  });
  return {
    lookup,
    async render(token: SubmissionToken) {
      selected = token;
      const page = await VoterPage({ params: Promise.resolve({ token: "synthetic-link" }) });
      assert.equal(page.type, VoterAppClient);
      return page.props as ComponentProps<typeof VoterAppClient>;
    },
  };
}

function formatted(date: Date): string {
  return date.toLocaleString("sk-SK", { timeZone: "Europe/Bratislava", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", " o");
}

test("an unused replacement link and an older used link both show the newest submitted ballot", async t => {
  const tokens: SubmissionToken[] = [
    { id: "new-unused", pollId: "poll", unitId: "unit", ownerId: null, usedAt: null },
    { id: "older-used", pollId: "poll", unitId: "unit", ownerId: null, usedAt: new Date("2026-09-13T09:00:00Z") },
    { id: "latest-used", pollId: "poll", unitId: "unit", ownerId: null, usedAt: new Date("2026-09-13T10:00:00Z") },
    { id: "foreign-poll", pollId: "other-poll", unitId: "unit", ownerId: null, usedAt: new Date("2026-09-13T11:00:00Z") },
    { id: "foreign-unit", pollId: "poll", unitId: "other-unit", ownerId: null, usedAt: new Date("2026-09-13T12:00:00Z") },
  ];
  const page = fixture(t, tokens);
  for (const token of [tokens[0], tokens[1]]) {
    const props = await page.render(token);
    assert.equal(props.initialSubmittedAt, formatted(tokens[2].usedAt!));
    assert.deepEqual(props.initialAnswers, { 1: "disagree" });
  }
  assert.equal(page.lookup.mock.callCount(), 2);
});

test("another co-owner's confirmed link never marks this owner's ballot as submitted", async t => {
  const tokens: SubmissionToken[] = [
    { id: "owner-a-unused", pollId: "poll", unitId: "unit", ownerId: "owner-a", usedAt: null },
    { id: "owner-b-used", pollId: "poll", unitId: "unit", ownerId: "owner-b", usedAt: new Date("2026-09-13T10:00:00Z") },
  ];
  const page = fixture(t, tokens, "owner-a");
  const props = await page.render(tokens[0]);
  assert.equal(props.initialSubmittedAt, null);
  assert.equal(props.owner!.id, "owner-a");
});

test("legacy vote rows without any confirmed token do not show a submitted ballot", async t => {
  const token: SubmissionToken = { id: "unused", pollId: "poll", unitId: "unit", ownerId: null, usedAt: null };
  const page = fixture(t, [token]);
  const props = await page.render(token);
  assert.deepEqual(props.initialAnswers, { 1: "disagree" });
  assert.equal(props.initialSubmittedAt, null);
});
