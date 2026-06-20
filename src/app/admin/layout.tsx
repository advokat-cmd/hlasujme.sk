import React from "react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. Verify admin is logged in
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  // 2. Fetch active poll (to pass link to sidebar)
  const activePoll = await db.poll.findFirst({
    where: { status: "active" }
  });

  return (
    <div className="admin-layout-wrapper">
      {/* Sidebar (Client Component to handle client state and hooks) */}
      <AdminSidebar user={session} activePollId={activePoll?.id || null} />

      {/* Main content scroll container */}
      <main
        style={{
          flex: 1,
          overflow: "auto",
          background: "var(--paper)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </main>
    </div>
  );
}
