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
    .from("pricing_lines")
    .select(
      "id, labor_category, rate_type, site_or_post, proposed_rate, awarded_rate, current_rate, requested_rate, unit, opportunity_id, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(body.limit ?? 20);
  if (body.query?.trim()) q = q.ilike("labor_category", `%${body.query.trim().replace(/[%_]/g, "")}%`);
  const { data, error } = await q;
  const evidence = (data ?? []).map((row) => ({
    id: makeEvidenceId("price", row.id),
    rail: "internal" as const,
    evidence_class: "INTERNAL_VERIFIED" as const,
    source_authority: SOURCE_AUTHORITY.INTERNAL_VERIFIED,
    title: row.labor_category,
    excerpt: `requested=${row.requested_rate ?? "—"} proposed=${row.proposed_rate ?? "—"} awarded=${row.awarded_rate ?? "—"} current=${row.current_rate ?? "—"}`,
    verification_status: "HUMAN_VERIFIED",
  }));
  return NextResponse.json({ ok: !error, error: error?.message ?? null, count: evidence.length, evidence });
}
