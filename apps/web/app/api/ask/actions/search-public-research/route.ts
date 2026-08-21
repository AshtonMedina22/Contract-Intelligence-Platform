import { NextResponse } from "next/server";
import { assertActionsAuth } from "@/lib/ask/actions-auth";
import { getPublicResearchProvider, toPublicEvidence } from "@/lib/ask/research/provider";

export async function POST(req: Request) {
  const denied = await assertActionsAuth(req);
  if (denied) return denied;
  const body = (await req.json()) as { query?: string; limit?: number };
  if (!body.query?.trim()) return NextResponse.json({ error: "query required" }, { status: 400 });
  const provider = getPublicResearchProvider();
  if (!provider) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: "Set TAVILY_API_KEY or BRAVE_SEARCH_API_KEY for public research.",
      evidence: [],
    });
  }
  const hits = await provider.search(body.query.trim(), body.limit ?? 8);
  const evidence = hits.map((h) => toPublicEvidence(h, body.query));
  return NextResponse.json({ ok: true, configured: true, provider: provider.id, count: evidence.length, evidence });
}
