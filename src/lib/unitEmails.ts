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
  return coMode === "single" || coMode === "bsm" ? unitEmail?.trim() || "" : "";
}

export function ownerEmailLabelForDisplay(
  coMode: unknown,
  unitEmail: string | null | undefined,
  ownerEmail: string | null | undefined,
): string {
  const displayedEmail = ownerEmailForDisplay(coMode, unitEmail, ownerEmail);
  if (!displayedEmail) return "bez e-mailu";
  return coMode === "bsm" && !ownerEmail?.trim()
    ? `spoločný e-mail: ${displayedEmail}`
    : displayedEmail;
}

export function unitOwnerSummaries<T extends { name?: string | null; email?: string | null }>(
  coMode: unknown,
  unitEmail: string | null | undefined,
  owners: T[],
): Array<{ name: string; emailLabel: string }> {
  return owners.map((owner) => {
    const personalEmail = owner.email?.trim() || "";
    const fallbackEmail = unitEmail?.trim() || "";
    const usesBsmFallback = coMode === "bsm" && !personalEmail && fallbackEmail;
    const usesUnitFallback = ["legal", "rep", "majority"].includes(String(coMode)) && !personalEmail && fallbackEmail;
    const displayedEmail = personalEmail
      || (coMode === "single" || usesBsmFallback || usesUnitFallback ? fallbackEmail : "");

    return {
      name: owner.name?.trim() || "Vlastník",
      emailLabel: !displayedEmail
        ? "bez e-mailu"
        : usesBsmFallback
          ? `spoločný: ${displayedEmail}`
          : usesUnitFallback
            ? `e-mail jednotky: ${displayedEmail}`
          : displayedEmail,
    };
  });
}

export function ownerEmailForEditing(
  coMode: unknown,
  unitEmail: string | null | undefined,
  ownerEmail: string | null | undefined,
): string {
  const editableOwnerEmail = ownerEmail?.trim();
  if (editableOwnerEmail) return editableOwnerEmail;
  return coMode === "single" ? unitEmail?.trim() || "" : "";
}

export function didLoginEmailChange(
  previousEmail: string | null | undefined,
  nextEmail: string | null | undefined,
): boolean {
  return normalizeEmail(previousEmail) !== normalizeEmail(nextEmail);
}
