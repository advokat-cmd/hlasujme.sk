export type AccountRole = "superadmin" | "admin" | "vlastnik";

interface Actor { adminId: string; role: string }
interface Target { id: string; role: string }

export function assertAccountMutationAllowed(actor: Actor, target: Target | null, requestedRole: string): void {
  const roles: AccountRole[] = ["superadmin", "admin", "vlastnik"];
  if (!roles.includes(requestedRole as AccountRole)) throw new Error("Neplatná rola účtu.");
  if (target?.role === "superadmin" && actor.role !== "superadmin") {
    throw new Error("Účet superadmina môže meniť iba superadmin.");
  }
  if (target?.role === "admin" && actor.role !== "superadmin" && (target.id !== actor.adminId || requestedRole !== "admin")) {
    throw new Error("Iného administrátora môže meniť iba superadmin.");
  }
  const isOwnUnchangedRole = target?.id === actor.adminId && target.role === requestedRole;
  if ((requestedRole === "admin" || requestedRole === "superadmin") && actor.role !== "superadmin" && !isOwnUnchangedRole) {
    throw new Error("Na pridelenie administrátorských oprávnení je potrebný superadmin.");
  }
}

export function assertOwnerBelongsToUnit(owner: { unitId: string }, unitId: string): void {
  if (owner.unitId !== unitId) throw new Error("Vlastník nepatrí do zadanej jednotky.");
}
