import { NextResponse } from "next/server";
import { assertActionsAuth } from "@/lib/ask/actions-auth";
import { SOURCE_AUTHORITY, makeEvidenceId } from "@/lib/ask/evidence";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const denied = await assertActionsAuth(req);
  if (denied) return denied;
  const body = (await req.json()) as { limit?: number };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("awards")
    .select("id, notice, winner_name, amount_nte, awarded_on, rank, source_document_id")
    .order("awarded_on", { ascending: false })
    .limit(body.limit ?? 20);
  const evidence = (data ?? []).map((row) => ({
    id: makeEvidenceId("award", row.id),
    rail: "internal" as const,
    evidence_class: "INTERNAL_VERIFIED" as const,
    source_authority: SOURCE_AUTHORITY.INTERNAL_VERIFIED,
    title: row.notice || row.winner_name || "Award",
    excerpt: `winner=${row.winner_name ?? "—"} amount_nte=${row.amount_nte ?? "—"} awarded_on=${row.awarded_on ?? "—"}`,
    document_id: row.source_document_id,
  }));
  return NextResponse.json({ ok: !error, error: error?.message ?? null, count: evidence.length, evidence });
}
