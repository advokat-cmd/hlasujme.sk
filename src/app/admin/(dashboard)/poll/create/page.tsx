import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import CreatePollClient from "./CreatePollClient";

export default async function CreatePollPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "admin" && session.role !== "superadmin") redirect("/admin");
  return <CreatePollClient />;
}
