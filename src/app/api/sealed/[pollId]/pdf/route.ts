import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    // 1. Verify admin is signed in
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Neprihlásený administrátor." }, { status: 401 });
    }

    const { pollId } = await params;

    // 2. Fetch SealedResult record
    const sealedResult = await db.sealedResult.findUnique({
      where: { pollId }
    });

    if (!sealedResult) {
      return NextResponse.json({ error: "Zápisnica pre toto hlasovanie zatiaľ nebola vytvorená." }, { status: 404 });
    }

    // 3. Resolve absolute file path
    // sealedResult.pdfPath has format: "/storage/sealed/[pollId]_zapisnica.pdf"
    const fileName = path.basename(sealedResult.pdfPath);
    const absolutePath = path.join(process.cwd(), "storage", "sealed", fileName);

    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: "Súbor zápisnice nebol nájdený na serveri." }, { status: 404 });
    }

    // 4. Read PDF file buffer
    const fileBuffer = fs.readFileSync(absolutePath);

    // 5. Return PDF stream response
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`
      }
    });
  } catch (err) {
    console.error("Download PDF API error:", err);
    return NextResponse.json({ error: "Chyba pri sťahovaní zápisnice." }, { status: 500 });
  }
}
