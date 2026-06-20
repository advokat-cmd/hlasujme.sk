import React from "react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { RegisterView } from "@/components/admin/RegisterView";

export const revalidate = 0; // Prevent server caching

export default async function AdminRegisterPage() {
  // 1. Verify admin session
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  // 2. Fetch building details
  const building = await db.building.findFirst();
  if (!building) {
    redirect("/admin");
  }

  // 3. Fetch all units with owners
  const units = await db.unit.findMany({
    where: { buildingId: building.id },
    orderBy: { no: "asc" },
    include: {
      owners: {
        include: {
          admins: true
        }
      }
    }
  });

  // 4. Compute statistics
  const unitsCount = units.length;
  const nonResCount = units.filter(u => u.type === "nebyt").length;
  const totalVotes = units.reduce((sum, u) => sum + (u.votes || 1), 0);
  const ownersCount = units.reduce((sum, u) => sum + u.owners.length, 0);

  // Map to matching client view interface
  const mappedUnits = units.map(u => ({
    id: u.id,
    no: u.no,
    type: u.type,
    floor: u.floor,
    votes: u.votes,
    coMode: u.coMode,
    email: u.email,
    actingPerson: u.actingPerson,
    label: u.label,
    owners: u.owners.map(o => ({
      id: o.id,
      first: o.first,
      last: o.last,
      name: o.name,
      email: o.email,
      share: o.share,
      role: o.role,
      admin: o.admins.length > 0
    }))
  }));

  return (
    <RegisterView
      building={{
        id: building.id,
        name: building.name,
        short: building.short,
        address: building.address,
        entrance: building.entrance,
        manager: building.manager,
        contact: building.contact,
        contactEmail: building.contactEmail
      }}
      units={mappedUnits}
      stats={{
        unitsCount,
        nonResCount,
        ownersCount,
        totalVotes
      }}
    />
  );
}
