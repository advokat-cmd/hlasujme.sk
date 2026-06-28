import React from "react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { SettingsView } from "@/components/admin/SettingsView";

export const revalidate = 0; // Disable server cache

export default async function AdminSettingsPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  if (session.role === "vlastnik") {
    redirect("/admin");
  }

  const templates = await db.questionTemplate.findMany({
    orderBy: { createdAt: "asc" }
  });

  // Map to clean client model
  const mappedTemplates = templates.map(t => ({
    id: t.id,
    title: t.title,
    text: t.text,
    majorityType: t.majorityType,
    note: t.note || ""
  }));

  return <SettingsView templates={mappedTemplates} />;
}
