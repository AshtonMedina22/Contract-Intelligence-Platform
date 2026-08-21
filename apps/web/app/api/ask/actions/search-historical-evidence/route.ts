import { NextResponse } from "next/server";
import { assertActionsAuth, purposeFromRequest } from "@/lib/ask/actions-auth";
import { embedQuery } from "@/lib/ask/model";
import { SOURCE_AUTHORITY, makeEvidenceId } from "@/lib/ask/evidence";
import { searchVerifiedKnowledge } from "@/lib/retrieval/search";

export async function POST(req: Request) {
  const denied = await assertActionsAuth(req);
  if (denied) return denied;
  const body = (await req.json()) as { query?: string; limit?: number; purpose?: string; opportunityId?: string };
  if (!body.query?.trim()) return NextResponse.json({ error: "query required" }, { status: 400 });
  const purpose = purposeFromRequest(req, body);
  const embedding = await embedQuery(body.query.trim());
  const { hits, error } = await searchVerifiedKnowledge({
    query: body.query.trim(),
    purpose,
    opportunityId: body.opportunityId?.trim() || null,
    queryEmbedding: embedding,
    limit: body.limit ?? 50,
  });
  const evidence = hits.map((hit) => ({
    id: makeEvidenceId("chunk", hit.chunk_id),
    rail: "internal" as const,
    evidence_class: "INTERNAL_VERIFIED" as const,
    source_authority: SOURCE_AUTHORITY.INTERNAL_VERIFIED,
    title: hit.storage_path || hit.field || "Verified passage",
    url: null,
    internal_ref: `/ingestion/verification/${hit.document_id}`,
    document_id: hit.document_id,
    chunk_id: hit.chunk_id,
    page: hit.source_page,
    excerpt: hit.content,
    verification_status: "HUMAN_VERIFIED",
  }));
  return NextResponse.json({ ok: !error, error, count: evidence.length, evidence });
}
