import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Neprihlásený administrátor." }, { status: 401 });
    }

    const { id: pollId } = await params;
    const poll = await db.poll.findUnique({
      where: { id: pollId },
      include: { documents: { orderBy: { createdAt: "asc" } } },
    });

    if (!poll) {
      return NextResponse.json({ error: "Hlasovanie nebolo nájdené." }, { status: 404 });
    }

    const files = poll.documents.map(document => ({
      id: document.id,
      name: document.name,
      mimeType: document.mimeType,
      webViewLink: `/api/document/${document.id}`,
    }));

    return NextResponse.json({ files });
  } catch (err) {
    console.error("Error fetching files:", err);
    return NextResponse.json({ error: "Chyba pri načítaní súborov." }, { status: 500 });
  }
}
