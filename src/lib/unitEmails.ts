type EmailOwner = { email?: string | null };

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function synchronizeSingleOwnerEmail<T extends EmailOwner>(
  coMode: unknown,
  unitEmail: string,
  owners: T[],
): { unitEmail: string; owners: T[] } {
  if (coMode !== "single" || owners.length !== 1) {
    return { unitEmail, owners };
  }

  const normalizedUnitEmail = normalizeEmail(unitEmail);
  const normalizedOwnerEmail = normalizeEmail(owners[0].email);
  if (normalizedUnitEmail && normalizedOwnerEmail && normalizedUnitEmail !== normalizedOwnerEmail) {
    throw new Error("E-mail jednotky a jediného vlastníka sa nezhodujú.");
  }

  const synchronizedEmail = normalizedUnitEmail || normalizedOwnerEmail;
  return {
    unitEmail: synchronizedEmail,
    owners: [{ ...owners[0], email: synchronizedEmail }],
  };
}

export function ownerEmailForDisplay(
  coMode: unknown,
  unitEmail: string | null | undefined,
  ownerEmail: string | null | undefined,
): string {
  const displayedOwnerEmail = ownerEmail?.trim();
  if (displayedOwnerEmail) return displayedOwnerEmail;
  return coMode === "single" ? unitEmail?.trim() || "" : "";
}

export function didLoginEmailChange(
  previousEmail: string | null | undefined,
  nextEmail: string | null | undefined,
): boolean {
  return normalizeEmail(previousEmail) !== normalizeEmail(nextEmail);
}
