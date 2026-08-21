import { NextResponse } from "next/server";
import { assertActionsAuth } from "@/lib/ask/actions-auth";
import { SOURCE_AUTHORITY, makeEvidenceId } from "@/lib/ask/evidence";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const denied = await assertActionsAuth(req);
  if (denied) return denied;
  const body = (await req.json()) as { query?: string; limit?: number };
  const supabase = await createClient();
  let q = supabase
    .from("contracts")
    .select("id, title, contract_number, start_on, verified_end_on, source_document_id")
    .order("updated_at", { ascending: false })
    .limit(body.limit ?? 20);
  if (body.query?.trim()) {
    const p = `%${body.query.trim().replace(/[%_]/g, "")}%`;
    q = q.or(`title.ilike.${p},contract_number.ilike.${p}`);
  }
  const { data, error } = await q;
  const evidence = (data ?? []).map((row) => ({
    id: makeEvidenceId("contract", row.id),
    rail: "internal" as const,
    evidence_class: "INTERNAL_VERIFIED" as const,
    source_authority: SOURCE_AUTHORITY.INTERNAL_VERIFIED,
    title: row.title,
    excerpt: `number=${row.contract_number ?? "—"} ${row.start_on ?? ""}–${row.verified_end_on ?? ""}`,
    document_id: row.source_document_id,
  }));
  return NextResponse.json({ ok: !error, error: error?.message ?? null, count: evidence.length, evidence });
}
