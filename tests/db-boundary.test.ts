import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("the Prisma seed guards the database before deleting data", () => {
  const source = readFileSync("prisma/seed.ts", "utf8");
  const guard = source.indexOf("assertSafeDestructiveDatabase()");
  const firstDelete = source.indexOf(".deleteMany(");
  assert.ok(guard >= 0, "seed must call the destructive database guard");
  assert.ok(firstDelete >= 0 && guard < firstDelete, "guard must run before any deleteMany");
});

test("the close-poll diagnostic guards the database before creating test data", () => {
  const source = readFileSync("scripts/test-close-api.ts", "utf8");
  const guard = source.indexOf("assertSafeDestructiveDatabase()");
  const firstCreate = source.indexOf("db.poll.create(");
  assert.ok(guard >= 0, "diagnostic must call the destructive database guard");
  assert.ok(firstCreate >= 0 && guard < firstCreate, "guard must run before creating test data");
});
