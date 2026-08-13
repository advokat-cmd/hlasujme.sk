import assert from "node:assert/strict";
import test from "node:test";
import { renderConfirmationEmail } from "../src/lib/email";

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
