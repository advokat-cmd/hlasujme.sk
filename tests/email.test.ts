import assert from "node:assert/strict";
import test from "node:test";
import { renderConfirmationEmail, sendEmail } from "../src/lib/email";

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
