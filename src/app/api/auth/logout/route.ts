import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/session";

export async function POST() {
  try {
    await clearAdminSession();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Logout API error:", err);
    return NextResponse.json({ error: "Chyba pri odhlasovaní." }, { status: 500 });
  }
}
