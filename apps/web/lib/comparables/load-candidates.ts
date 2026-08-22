import { createClient } from "@/lib/supabase/server";
import type { DataClassification } from "@/lib/classification/types";
import type { CorpusClass } from "@/lib/supabase/database.types";
import { evaluateComparableAuthority } from "./authority";
import type { ComparablePurpose, PursuitComparableCandidate } from "./types";

export async function loadComparableCandidates(input: {
  targetOpportunityId: string;
  purpose: ComparablePurpose;
}): Promise<{ target: PursuitComparableCandidate | null; candidates: PursuitComparableCandidate[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { target: null, candidates: [] };
  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return { target: null, candidates: [] };
  const organizationId = membership.organization_id;

  const { data: opportunities } = await supabase
    .from("opportunities")
    .select(
      "id, organization_id, title, client_id, service_type, site_location, procurement_rail, solicitation_kind, response_due_on, created_at, clients(name)",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(250);
  if (!opportunities?.some((row) => row.id === input.targetOpportunityId)) {
    return { target: null, candidates: [] };
  }

  const ids = opportunities.map((row) => row.id);
  const [{ data: staffing }, { data: pricing }, { data: sections }, { data: reviews }, { data: packages }, { data: documents }] =
    await Promise.all([
      supabase.from("staffing_requirements").select("opportunity_id, weekly_hours").in("opportunity_id", ids),
      supabase.from("pricing_lines").select("opportunity_id").in("opportunity_id", ids),
      supabase
        .from("proposal_sections")
        .select("opportunity_id")
        .in("opportunity_id", ids)
        .eq("verification_status", "HUMAN_VERIFIED")
        .in("reuse_status", ["APPROVED", "REVIEW_REQUIRED"]),
      supabase.from("win_loss_reviews").select("opportunity_id, outcome").in("opportunity_id", ids),
      supabase.from("procurement_packages").select("opportunity_id, corpus_class").in("opportunity_id", ids),
      supabase.from("documents").select("opportunity_id, data_classification").in("opportunity_id", ids),
    ]);

  const hours = new Map<string, number>();
  const hoursObserved = new Set<string>();
  for (const row of staffing ?? []) {
    if (row.weekly_hours == null) continue;
    hoursObserved.add(row.opportunity_id);
    hours.set(row.opportunity_id, (hours.get(row.opportunity_id) ?? 0) + Number(row.weekly_hours));
  }
  const pricingCounts = countByOpportunity(pricing ?? []);
  const sectionCounts = countByOpportunity(sections ?? []);
  const outcomeByOpportunity = new Map((reviews ?? []).map((row) => [row.opportunity_id, row.outcome]));
  const packageByOpportunity = new Map<string, CorpusClass>();
  for (const row of packages ?? []) {
    if (!row.opportunity_id) continue;
    const next = row.corpus_class as CorpusClass;
    const current = packageByOpportunity.get(row.opportunity_id);
    // Mixed package authority fails toward the least permissive label; a Class C document set can
    // never be hidden by an A/B sibling linked to the same pursuit.
    if (next === "C_COMPETITOR_TEST" || !current) packageByOpportunity.set(row.opportunity_id, next);
    else if (next === "B_LP_TIED" && current === "A_LP_ORIGINATED") {
      packageByOpportunity.set(row.opportunity_id, next);
    }
  }
  const classificationsByOpportunity = new Map<string, DataClassification[]>();
  for (const row of documents ?? []) {
    if (!row.opportunity_id) continue;
    const values = classificationsByOpportunity.get(row.opportunity_id) ?? [];
    values.push(row.data_classification as DataClassification);
    classificationsByOpportunity.set(row.opportunity_id, values);
  }

  const candidates = opportunities.map((row): PursuitComparableCandidate => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const corpusClass = packageByOpportunity.get(row.id) ?? null;
    const classifications = classificationsByOpportunity.get(row.id) ?? [];
    return {
      id: row.id,
      organizationId: row.organization_id,
      title: row.title,
      clientId: row.client_id,
      clientName: client?.name ?? null,
      serviceType: row.service_type,
      siteLocation: row.site_location,
      procurementRail: row.procurement_rail,
      solicitationKind: row.solicitation_kind,
      responseDueOn: row.response_due_on,
      createdAt: row.created_at,
      weeklyHours: hoursObserved.has(row.id) ? hours.get(row.id) ?? 0 : null,
      pricingLineCount: pricingCounts.get(row.id) ?? 0,
      proposalSectionCount: sectionCounts.get(row.id) ?? 0,
      outcome: outcomeByOpportunity.get(row.id) ?? null,
      authority: evaluateComparableAuthority({
        targetOrganizationId: organizationId,
        candidateOrganizationId: row.organization_id,
        corpusClass,
        classifications,
        purpose: input.purpose,
      }),
    };
  });
  return {
    target: candidates.find((candidate) => candidate.id === input.targetOpportunityId) ?? null,
    candidates,
  };
}

function countByOpportunity(rows: readonly { opportunity_id: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.opportunity_id, (counts.get(row.opportunity_id) ?? 0) + 1);
  return counts;
}
