import assert from "node:assert/strict";
import test from "node:test";

import { assertSafeDestructiveDatabase } from "../scripts/check-db-boundary";

test("destructive database scripts reject the shared production schema", () => {
  assert.throws(
    () => assertSafeDestructiveDatabase(
      "postgresql://user:pass@db/lemon?schema=hlasujme",
      "1",
    ),
    /disposable test schema/i,
  );
});

test("destructive database scripts require an explicit opt-in", () => {
  assert.throws(
    () => assertSafeDestructiveDatabase(
      "postgresql://user:pass@db/lemon?schema=hlasujme_test_local",
      undefined,
    ),
    /ALLOW_DESTRUCTIVE_TEST_DB=1/,
  );
});

test("destructive database scripts allow only an opted-in test schema", () => {
  assert.doesNotThrow(() => assertSafeDestructiveDatabase(
    "postgresql://user:pass@db/lemon?schema=hlasujme_test_local",
    "1",
  ));
});
