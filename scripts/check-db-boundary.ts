export function assertSafeDestructiveDatabase(
  databaseUrl = process.env.DATABASE_URL,
  optIn = process.env.ALLOW_DESTRUCTIVE_TEST_DB,
): void {
  if (optIn !== "1") {
    throw new Error("Destructive database access requires ALLOW_DESTRUCTIVE_TEST_DB=1.");
  }
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");

  let schema: string | null;
  try {
    schema = new URL(databaseUrl).searchParams.get("schema");
  } catch {
    throw new Error("DATABASE_URL is invalid.");
  }

  if (!schema || !/^hlasujme_test_[a-z0-9_]+$/.test(schema)) {
    throw new Error(
      "Destructive database access is allowed only for a disposable test schema named hlasujme_test_*.",
    );
  }
}
