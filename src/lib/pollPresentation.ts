export function canManagePoll(role: string | undefined): boolean {
  return role === "admin" || role === "superadmin";
}

export function canSeePollResults(role: string | undefined, status: string): boolean {
  return canManagePoll(role) || (role === "vlastnik" && status === "closed");
}

export function allowedPollTab(role: string | undefined, requested: string | null): string {
  const allowed = canManagePoll(role)
    ? ["results", "units", "emails", "protocol", "documents"]
    : ["results", "protocol", "documents"];
  return requested && allowed.includes(requested) ? requested : "results";
}

export function pollStatusLabel(status: string, startAt: string, endAt: string, now = Date.now()): string {
  if (status === "draft") return "návrh";
  if (status === "closing") return "uzatvára sa";
  if (status === "closed") return "uzavreté";
  if (status !== "active") return "neznámy stav";
  if (new Date(startAt).getTime() > now) return "naplánované";
  if (new Date(endAt).getTime() < now) return "po termíne – čaká na uzavretie";
  return "prebieha";
}
