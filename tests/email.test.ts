import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { setImmediate as flushAsyncWork } from "node:timers/promises";
import { renderConfirmationEmail, sendEmail } from "../src/lib/email";

let testClock = Date.UTC(2030, 0, 1);

function mockRealEmail(t: TestContext) {
  const env = process.env as Record<string, string | undefined>;
  const previous = { NODE_ENV: env.NODE_ENV, EMAIL_PROVIDER: env.EMAIL_PROVIDER, EMAIL_API_KEY: env.EMAIL_API_KEY, EMAIL_FROM: env.EMAIL_FROM };
  env.NODE_ENV = "production";
  env.EMAIL_PROVIDER = "resend";
  env.EMAIL_API_KEY = "synthetic-provider-key-not-a-real-credential";
  env.EMAIL_FROM = "sender@example.test";
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  });
  testClock += 1_000_000;
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: testClock });
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
  t.mock.method(console, "warn", (...args: unknown[]) => { logs.push(args); });
  return { env, logs, startedAt: testClock };
}

const emailParams = (index: number) => ({
  to: `owner${index}@example.test`, subject: "Synthetic invitation", html: "<p>Test only</p>",
});

async function advanceClock(t: TestContext, ms: number) {
  t.mock.timers.tick(ms);
  await flushAsyncWork();
}

test("production never reports a mock or unconfigured email as delivered", async (t) => {
  const env = process.env as Record<string, string | undefined>;
  const previousMode = env.NODE_ENV;
  const previousKey = env.EMAIL_API_KEY;
  const fetchMock = t.mock.method(globalThis, "fetch", () => { throw new Error("Network must not be used by mock email tests"); });
  t.mock.method(console, "error", () => {});
  try {
    env.NODE_ENV = "production";
    for (const key of [undefined, "", "re_mock_test", "pm_mock_test"]) {
      if (key === undefined) delete env.EMAIL_API_KEY;
      else env.EMAIL_API_KEY = key;
      assert.equal(await sendEmail({ to: "owner@example.test", subject: "Test", html: "Test" }), false);
    }
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally {
    if (previousMode === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previousMode;
    if (previousKey === undefined) delete env.EMAIL_API_KEY;
    else env.EMAIL_API_KEY = previousKey;
  }
});

test("confirmation email replaces buildingShort in subject and body", () => {
  const result = renderConfirmationEmail(
    {
      subject: "Potvrdenie – {buildingShort}: {pollTitle}",
      body: "<p>byt č. {unitNo} vo vchode {buildingShort}</p>",
    },
    {
      ownerName: "Milan Ficek",
      unitNo: "6",
      buildingShort: "Björnsonova 3",
      pollTitle: "Oprava strechy",
      dateFormatted: "29. 7. 2026 18:44",
      answersSummary: [],
    },
  );

  assert.equal(result.subject, "Potvrdenie – Björnsonova 3: Oprava strechy");
  assert.match(result.html, /byt č\. 6 vo vchode Björnsonova 3/);
  assert.doesNotMatch(result.subject + result.html, /\{buildingShort\}/);
});

test("14 simultaneous calls across both providers share batches of five at 0, 5 and 10 seconds", async (t) => {
  const { env, startedAt } = mockRealEmail(t);
  const starts: { time: number; url: string }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    starts.push({ time: Date.now() - startedAt, url: String(url) });
    return Response.json({ id: "synthetic-message" });
  });
  const sends = Array.from({ length: 7 }, (_, i) => sendEmail(emailParams(i)));
  env.EMAIL_PROVIDER = "postmark";
  sends.push(...Array.from({ length: 7 }, (_, i) => sendEmail(emailParams(i + 7))));
  await flushAsyncWork();
  assert.equal(starts.length, 5);
  await advanceClock(t, 4999);
  assert.equal(starts.length, 5);
  await advanceClock(t, 1);
  assert.equal(starts.length, 10);
  await advanceClock(t, 5000);
  assert.deepEqual(await Promise.all(sends), Array(14).fill(true));
  assert.deepEqual(starts.map(start => start.time), [...Array(5).fill(0), ...Array(5).fill(5000), ...Array(4).fill(10000)]);
  assert.equal(starts.filter(start => start.url.includes("api.resend.com")).length, 7);
  assert.equal(starts.filter(start => start.url.includes("api.postmarkapp.com")).length, 7);
});

test("a delayed timer starts a new batch from the real clock without a catch-up burst", async (t) => {
  const { startedAt } = mockRealEmail(t);
  const starts: number[] = [];
  t.mock.method(globalThis, "fetch", async () => {
    starts.push(Date.now() - startedAt);
    return Response.json({ id: "synthetic-message" });
  });
  const sends = Array.from({ length: 14 }, (_, i) => sendEmail(emailParams(i)));
  await flushAsyncWork();
  await advanceClock(t, 12000);
  assert.equal(starts.length, 10);
  await advanceClock(t, 4999);
  assert.equal(starts.length, 10);
  await advanceClock(t, 1);
  assert.deepEqual(await Promise.all(sends), Array(14).fill(true));
  assert.deepEqual(starts, [...Array(5).fill(0), ...Array(5).fill(12000), ...Array(4).fill(17000)]);
});

test("rate-limit retry shares cooldown with new sends and reuses its key and payload", async (t) => {
  const { startedAt, logs } = mockRealEmail(t);
  const calls: { time: number; body: string; key: string | null }[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    calls.push({ time: Date.now() - startedAt, body: String(options.body), key: new Headers(options.headers).get("Idempotency-Key") });
    return calls.length === 1
      ? Response.json({ name: "rate_limit_exceeded", message: "Do not log https://example.test/hlasuj/private-token" }, { status: 429, headers: { "Retry-After": "2" } })
      : Response.json({ id: "synthetic-message" });
  });
  const first = sendEmail({ ...emailParams(1), html: "https://example.test/hlasuj/private-token" });
  await flushAsyncWork();
  const second = sendEmail(emailParams(2));
  await flushAsyncWork();
  assert.equal(calls.length, 1);
  await advanceClock(t, 1999);
  assert.equal(calls.length, 1);
  await advanceClock(t, 1);
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.deepEqual(calls.map(call => call.time), [0, 2000, 2000]);
  assert.ok(calls[0].key);
  assert.equal(calls[0].key, calls[1].key);
  assert.equal(calls[0].body, calls[1].body);
  assert.notEqual(calls[0].key, calls[2].key);
  assert.doesNotMatch(JSON.stringify(logs), /private-token|synthetic-provider-key/);
});

test("HTTP-date Retry-After is respected and retries consume the shared batch slots", async (t) => {
  const { startedAt } = mockRealEmail(t);
  const starts: number[] = [];
  t.mock.method(globalThis, "fetch", async () => {
    starts.push(Date.now() - startedAt);
    return starts.length === 1
      ? Response.json({ name: "rate_limit_exceeded" }, { status: 429, headers: { "Retry-After": new Date(startedAt + 3000).toUTCString() } })
      : Response.json({ id: "synthetic-message" });
  });
  const retry = sendEmail(emailParams(0));
  await flushAsyncWork();
  await advanceClock(t, 2999);
  assert.equal(starts.length, 1);
  await advanceClock(t, 1);
  assert.equal(await retry, true);
  const others = Array.from({ length: 4 }, (_, i) => sendEmail(emailParams(i + 1)));
  await flushAsyncWork();
  assert.equal(starts.length, 5);
  await advanceClock(t, 1999);
  assert.equal(starts.length, 5);
  await advanceClock(t, 1);
  assert.deepEqual(await Promise.all(others), Array(4).fill(true));
  assert.deepEqual(starts, [0, 3000, 3000, 3000, 3000, 5000]);
});

test("only explicit Resend rate limits retry; quota, authorization, validation and network failures do not", async (t) => {
  const { logs } = mockRealEmail(t);
  const responses = [
    { status: 429, name: "daily_quota_exceeded" },
    { status: 429, name: "monthly_quota_exceeded" },
    { status: 403, name: "validation_error" },
    { status: 422, name: "validation_error" },
    { status: 503, name: "service_unavailable" },
  ];
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    const next = responses.shift();
    if (!next) throw new Error("Do not log https://example.test/hlasuj/private-token");
    return Response.json({ name: next.name, message: "private-token synthetic-provider-key" }, { status: next.status });
  });
  for (let i = 0; i < 5; i++) assert.equal(await sendEmail(emailParams(i)), false);
  const networkFailure = sendEmail(emailParams(5));
  await flushAsyncWork();
  await advanceClock(t, 5000);
  assert.equal(await networkFailure, false);
  assert.equal(fetchMock.mock.callCount(), 6);
  assert.match(JSON.stringify(logs), /owner0@example\.test/);
  assert.match(JSON.stringify(logs), /daily_quota_exceeded/);
  assert.doesNotMatch(JSON.stringify(logs), /private-token|synthetic-provider-key/);

  fetchMock.mock.mockImplementation(async () => Response.json({ id: "recovered-message" }));
  assert.equal(await sendEmail(emailParams(6)), true, "a rejected fetch must not poison the queue");
});

test("rate-limit retries stop after four attempts and excessively long cooldowns do not retry early", async (t) => {
  mockRealEmail(t);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json({ name: "rate_limit_exceeded" }, { status: 429, headers: { "Retry-After": "1" } }));
  const failed = sendEmail(emailParams(0));
  await flushAsyncWork();
  for (let i = 0; i < 3; i++) await advanceClock(t, 1000);
  assert.equal(await failed, false);
  assert.equal(fetchMock.mock.callCount(), 4);
  await advanceClock(t, 1000);
  fetchMock.mock.mockImplementation(async () => Response.json({ name: "rate_limit_exceeded" }, { status: 429, headers: { "Retry-After": "60" } }));
  assert.equal(await sendEmail(emailParams(1)), false);
  assert.equal(fetchMock.mock.callCount(), 5);
  assert.equal(await sendEmail(emailParams(2)), false, "new sends must not ignore the provider cooldown");
  assert.equal(fetchMock.mock.callCount(), 5);
});
