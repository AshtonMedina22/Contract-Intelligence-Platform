import { NextResponse } from "next/server";
import { assertActionsAuth } from "@/lib/ask/actions-auth";
import { locateRecords } from "@/lib/retrieval/search";

export async function POST(req: Request) {
  const denied = await assertActionsAuth(req);
  if (denied) return denied;
  const body = (await req.json()) as { query?: string };
  if (!body.query?.trim()) return NextResponse.json({ error: "query required" }, { status: 400 });
  const records = await locateRecords(body.query.trim());
  return NextResponse.json({ count: records.length, records });
}
