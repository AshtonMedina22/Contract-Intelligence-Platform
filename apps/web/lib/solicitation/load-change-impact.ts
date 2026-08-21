import { createClient } from "@/lib/supabase/server";
import { buildImpactSummary, type ImpactSummary } from "@/lib/solicitation/impact-summary";
import type { ChangeImpactStripItem } from "@/components/opportunity-workspace/change-impact-strip";
import { memberHasPermission } from "@/lib/auth/permissions";

export type ChangeImpactBundle = {
  summary: ImpactSummary;
  items: ChangeImpactStripItem[];
  canVerify: boolean;
};

export async function loadChangeImpactBundle(
  opportunityId: string,
): Promise<ChangeImpactBundle | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: sols } = await supabase
    .from("solicitations")
    .select("id, organization_id")
    .eq("opportunity_id", opportunityId);
  if (!sols?.length) {
    return {
      summary: buildImpactSummary([]),
      items: [],
      canVerify: false,
    };
  }

  const orgId = sols[0].organization_id;
  const solIds = sols.map((s) => s.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: runs } = await db
    .from("solicitation_change_runs")
    .select("id")
    .eq("organization_id", orgId)
    .in("solicitation_id", solIds);

  const runIds = (runs ?? []).map((r: { id: string }) => r.id);
  if (runIds.length === 0) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    return {
      summary: buildImpactSummary([], 0),
      items: [],
      canVerify: membership
        ? memberHasPermission(membership.role, "verify.promote")
        : false,
    };
  }

  const { data: items } = await db
    .from("solicitation_change_items")
    .select(
      "id, change_type, verification_status, ambiguity_reason, applied_at, before_text, after_text, impact_flags",
    )
    .eq("organization_id", orgId)
    .in("change_run_id", runIds)
    .order("created_at", { ascending: false })
    .limit(50);

  const mapped = (items ?? []) as ChangeImpactStripItem[];
  const summary = buildImpactSummary(
    (items ?? []).map(
      (i: {
        change_type: string;
        verification_status: string;
        ambiguity_reason?: string | null;
        applied_at?: string | null;
        impact_flags?: Record<string, boolean> | null;
      }) => ({
        change_type: i.change_type,
        verification_status: i.verification_status,
        ambiguity_reason: i.ambiguity_reason,
        applied_at: i.applied_at,
        impact_flags: i.impact_flags,
      }),
    ),
    runIds.length,
  );

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    summary,
    items: mapped,
    canVerify: membership ? memberHasPermission(membership.role, "verify.promote") : false,
  };
}
