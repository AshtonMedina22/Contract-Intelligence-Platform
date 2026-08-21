import { createClient } from "@/lib/supabase/server";
import { searchVerifiedKnowledge, type KnowledgeHit } from "@/lib/retrieval/search";
import type { RetrievalPurpose } from "@/lib/retrieval/purpose";
import {
  collectSourceFactIds,
  filterRowsBySourceClassification,
  loadDocumentClassifications,
  loadSourceFactClassifications,
} from "@/lib/classification/source-filter";
import { eligibilityLimitation, isClassificationEligible } from "@/lib/classification/eligibility";

export type ReportKind =
  | "bid_strategy"
  | "buyer"
  | "market"
  | "competitor"
  | "pricing"
  | "win_loss"
  | "proposal_improvement"
  | "executive";

export type IntelligenceReport = {
  kind: ReportKind;
  purpose: RetrievalPurpose;
  title: string;
  answer: string;
  sections: { heading: string; bullets: string[] }[];
  sources: { label: string; href?: string }[];
  dataScope: string;
  limitations: string;
  insufficient: boolean;
  evidenceHits: KnowledgeHit[];
  reportRunId: string | null;
};

const INSUFFICIENT = "Insufficient verified evidence to answer this reliably.";

export const REPORT_CATALOG: {
  kind: ReportKind;
  title: string;
  purpose: RetrievalPurpose;
  body: string;
}[] = [
  {
    kind: "bid_strategy",
    title: "Bid Strategy Report",
    purpose: "BID_STRATEGY",
    body: "Opportunity summary, requirements, L&P history, competitors, pricing evidence, reusable content, gaps.",
  },
  {
    kind: "buyer",
    title: "Buyer Intelligence Brief",
    purpose: "GENERAL_QA",
    body: "Prior solicitations, awards, contracts, outcomes, sourced public research for the issuing agency.",
  },
  {
    kind: "market",
    title: "Market Intelligence Report",
    purpose: "REPORT_GENERATION",
    body: "Verified awards, win/loss, sourced bids, pricing lines, rebid alerts — never document-count market share.",
  },
  {
    kind: "competitor",
    title: "Competitor Intelligence Report",
    purpose: "COMPETITOR_ANALYSIS",
    body: "Observed bids, pricing lines, scores/rank, outcomes. Observed-only — not corporate win rate.",
  },
  {
    kind: "pricing",
    title: "Pricing Intelligence Report",
    purpose: "PRICING_ANALYSIS",
    body: "Four-truth lines and competitor quotes with sources. Final price stays human.",
  },
  {
    kind: "win_loss",
    title: "Win/Loss Analysis Report",
    purpose: "LOSS_ANALYSIS",
    body: "Documented reasons stay separate from internal analysis. Scores and prices from verified tables.",
  },
  {
    kind: "proposal_improvement",
    title: "Proposal Improvement / Evaluator Analysis",
    purpose: "LOSS_ANALYSIS",
    body: "Evaluator comments, category scores, lessons — retrospective; DO_NOT_USE may appear for analysis only.",
  },
  {
    kind: "executive",
    title: "Executive Intelligence Brief",
    purpose: "REPORT_GENERATION",
    body: "Portfolio snapshot: awards, win/loss, rebids, open automation alerts. Every bullet needs evidence.",
  },
];

export async function generateIntelligenceReport(
  kind: ReportKind,
  opts?: {
    opportunityId?: string | null;
    query?: string;
    persist?: boolean;
    parentReportRunId?: string | null;
  },
): Promise<IntelligenceReport> {
  const meta = REPORT_CATALOG.find((r) => r.kind === kind)!;
  const supabase = await createClient();
  const sources: { label: string; href?: string }[] = [];
  const sections: { heading: string; bullets: string[] }[] = [];

  const [
    awardsRaw,
    reviewsRaw,
    bidsRaw,
    pricingRaw,
    alertsRaw,
    researchRaw,
    scoresRaw,
    automation,
  ] = await Promise.all([
    supabase.from("awards").select("id, opportunity_id, amount_nte, notice, source_fact_id").limit(50),
    supabase
      .from("win_loss_reviews")
      .select("id, outcome, documented_reason, internal_analysis, lp_price, winning_price, winner_name, opportunity_id, source_fact_id")
      .limit(50),
    supabase
      .from("competitor_bids")
      .select("id, quoted_amount, rank, source_url, competitor_id, opportunity_id, source_fact_id")
      .limit(50),
    supabase
      .from("pricing_lines")
      .select("id, labor_category, proposed_rate, awarded_rate, current_rate, opportunity_id, requested_source_fact_id, proposed_source_fact_id, awarded_source_fact_id, current_source_fact_id")
      .limit(50),
    supabase.from("contract_alerts").select("id, bucket, days_until, verified_end_on, source_fact_id").limit(50),
    supabase.from("research_facts").select("id, title, source_url, source_document_id, verification_status").eq("verification_status", "HUMAN_VERIFIED").limit(50),
    supabase.from("evaluation_scores").select("id, respondent_name, points, max_points, rank, notes, source_fact_id").limit(50),
    supabase
      .from("automation_events")
      .select("id, kind, title, severity, due_on")
      .is("acknowledged_at", null)
      .limit(50),
  ]);

  const singleSourceFields = ["source_fact_id"] as const;
  const pricingSourceFields = [
    "requested_source_fact_id",
    "proposed_source_fact_id",
    "awarded_source_fact_id",
    "current_source_fact_id",
  ] as const;
  const allFactRows = [
    ...(awardsRaw.data ?? []),
    ...(reviewsRaw.data ?? []),
    ...(bidsRaw.data ?? []),
    ...(pricingRaw.data ?? []),
    ...(alertsRaw.data ?? []),
    ...(scoresRaw.data ?? []),
  ] as unknown as Record<string, unknown>[];
  const factIds = collectSourceFactIds(allFactRows, [
    ...singleSourceFields,
    ...pricingSourceFields,
  ]);
  const classifications = await loadSourceFactClassifications(supabase, factIds);
  const filter = <T extends Record<string, unknown>>(
    rows: readonly T[],
    fields: readonly string[],
  ): T[] =>
    filterRowsBySourceClassification(rows, {
      fields,
      classifications,
      purpose: meta.purpose,
    });

  const researchDocumentIds = [
    ...new Set(
      (researchRaw.data ?? [])
        .map((row) => row.source_document_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  const documentClassifications = await loadDocumentClassifications(
    supabase,
    researchDocumentIds,
  );
  const awards = {
    ...awardsRaw,
    data: filter(
      (awardsRaw.data ?? []) as unknown as Record<string, unknown>[],
      singleSourceFields,
    ) as unknown as typeof awardsRaw.data,
  };
  const reviews = {
    ...reviewsRaw,
    data: filter(
      (reviewsRaw.data ?? []) as unknown as Record<string, unknown>[],
      singleSourceFields,
    ) as unknown as typeof reviewsRaw.data,
  };
  const bids = {
    ...bidsRaw,
    data: filter(
      (bidsRaw.data ?? []) as unknown as Record<string, unknown>[],
      singleSourceFields,
    ) as unknown as typeof bidsRaw.data,
  };
  const pricing = {
    ...pricingRaw,
    data: filter(
      (pricingRaw.data ?? []) as unknown as Record<string, unknown>[],
      pricingSourceFields,
    ) as unknown as typeof pricingRaw.data,
  };
  const alerts = {
    ...alertsRaw,
    data: filter(
      (alertsRaw.data ?? []) as unknown as Record<string, unknown>[],
      singleSourceFields,
    ) as unknown as typeof alertsRaw.data,
  };
  const scores = {
    ...scoresRaw,
    data: filter(
      (scoresRaw.data ?? []) as unknown as Record<string, unknown>[],
      singleSourceFields,
    ) as unknown as typeof scoresRaw.data,
  };
  const research = {
    ...researchRaw,
    data: (researchRaw.data ?? []).filter((row) => {
      const classification = row.source_document_id
        ? documentClassifications.get(row.source_document_id)
        : null;
      return classification
        ? isClassificationEligible(classification, meta.purpose)
        : false;
    }),
  };

  const competitorIds = [
    ...new Set(
      (bids.data ?? [])
        .map((b) => b.competitor_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  const oppIds = [
    ...new Set(
      [...(reviews.data ?? []), ...(bids.data ?? []), ...(pricing.data ?? [])]
        .map((r) => r.opportunity_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  const [{ data: competitorRows }, { data: opportunityRows }] = await Promise.all([
    competitorIds.length
      ? supabase.from("competitors").select("id, name").in("id", competitorIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    oppIds.length
      ? supabase.from("opportunities").select("id, title").in("id", oppIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);
  const competitorName = new Map((competitorRows ?? []).map((c) => [c.id, c.name]));
  const opportunityTitle = new Map((opportunityRows ?? []).map((o) => [o.id, o.title]));

  const q = opts?.query?.trim() || meta.title;
  const { hits } = await searchVerifiedKnowledge({
    query: q,
    purpose: meta.purpose,
    opportunityId: opts?.opportunityId,
    limit: 15,
  });

  if (kind === "market" || kind === "executive") {
    sections.push({
      heading: "Verified observations",
      bullets: [
        `Awards on file: ${awards.data?.length ?? 0}`,
        `Win/loss reviews: ${reviews.data?.length ?? 0}`,
        `Sourced competitor bids: ${bids.data?.length ?? 0}`,
        `Verified pricing lines: ${pricing.data?.length ?? 0}`,
        `Contract rebid alerts: ${alerts.data?.length ?? 0}`,
      ],
    });
    sources.push({ label: "awards / win_loss_reviews / competitor_bids / pricing_lines", href: "/intelligence/market" });
  }

  if (kind === "buyer" || kind === "bid_strategy" || kind === "executive") {
    sections.push({
      heading: "Public research",
      bullets:
        (research.data ?? []).length > 0
          ? (research.data ?? []).slice(0, 8).map((r) => `${r.title ?? "Untitled"} — ${r.source_url} (${r.verification_status})`)
          : ["No sourced research_facts."],
    });
    sources.push({ label: "research_facts", href: "/intelligence/clients" });
  }

  if (kind === "competitor" || kind === "bid_strategy" || kind === "win_loss") {
    sections.push({
      heading: "Sourced competitor bids",
      bullets:
        (bids.data ?? []).length > 0
          ? (bids.data ?? []).slice(0, 10).map((b) => {
              const name = b.competitor_id ? competitorName.get(b.competitor_id) : null;
              return `${name ?? "Unknown"}: ${b.quoted_amount ?? "—"} rank=${b.rank ?? "—"}`;
            })
          : ["No sourced competitor_bids."],
    });
    sources.push({ label: "competitor_bids", href: "/intelligence/competitors" });
  }

  if (kind === "pricing" || kind === "bid_strategy") {
    sections.push({
      heading: "Pricing lines (four truths)",
      bullets:
        (pricing.data ?? []).length > 0
          ? (pricing.data ?? []).slice(0, 10).map((p) => {
              const opp = p.opportunity_id ? opportunityTitle.get(p.opportunity_id) : null;
              return `${p.labor_category} @ ${opp ?? "—"} proposed=${p.proposed_rate ?? "—"} awarded=${p.awarded_rate ?? "—"}`;
            })
          : ["No verified pricing_lines."],
    });
    sources.push({ label: "pricing_lines", href: "/intelligence/pricing" });
  }

  if (kind === "win_loss" || kind === "proposal_improvement" || kind === "executive") {
    sections.push({
      heading: "Win/Loss (documented ≠ internal)",
      bullets:
        (reviews.data ?? []).length > 0
          ? (reviews.data ?? []).slice(0, 10).map((r) => {
              const opp = r.opportunity_id ? opportunityTitle.get(r.opportunity_id) : null;
              return `${opp ?? "Opportunity"}: ${r.outcome}; documented=${r.documented_reason ?? "—"}; internal=${r.internal_analysis ?? "—"}`;
            })
          : ["No win_loss_reviews."],
    });
    sources.push({ label: "win_loss_reviews", href: "/intelligence/win-loss" });
  }

  if (kind === "proposal_improvement" || kind === "competitor") {
    sections.push({
      heading: "Evaluation scores",
      bullets:
        (scores.data ?? []).length > 0
          ? (scores.data ?? []).slice(0, 10).map(
              (s) =>
                `${s.respondent_name}: ${s.points}${s.max_points != null ? `/${s.max_points}` : ""} rank=${s.rank ?? "—"}`,
            )
          : ["No evaluation_scores."],
    });
    sources.push({ label: "evaluation_scores", href: "/intelligence/competitors" });
  }

  if (kind === "executive") {
    sections.push({
      heading: "Open automation alerts",
      bullets:
        (automation.data ?? []).length > 0
          ? (automation.data ?? []).slice(0, 10).map((a) => `[${a.severity}] ${a.title}`)
          : ["No open automation_events."],
    });
    sources.push({ label: "automation_events" });
  }

  if (hits.length > 0) {
    sections.push({
      heading: "Verified narrative evidence",
      bullets: hits.slice(0, 8).map((h, i) => `[${i + 1}] ${h.content.slice(0, 160)}…`),
    });
    sources.push({ label: "document_chunks (HUMAN_VERIFIED)", href: "/intelligence/content" });
  }

  const hasBusiness =
    (awards.data?.length ?? 0) +
      (reviews.data?.length ?? 0) +
      (bids.data?.length ?? 0) +
      (pricing.data?.length ?? 0) +
      (research.data?.length ?? 0) +
      hits.length >
    0;

  const insufficient = !hasBusiness;
  const answer = insufficient
    ? INSUFFICIENT
    : `${meta.title} assembled from verified canonical records only. See sections and sources. Unsupported conclusions withheld.`;

  const report: IntelligenceReport = {
    kind,
    purpose: meta.purpose,
    title: meta.title,
    answer,
    sections,
    sources,
    dataScope: opts?.opportunityId
      ? `Tenant-scoped; pursuit ${opts.opportunityId}; purpose ${meta.purpose}`
      : `Tenant-scoped cross-corpus; purpose ${meta.purpose}`,
    limitations: insufficient
      ? `No verified awards, win/loss, bids, pricing lines, research, or chunks available. ${eligibilityLimitation(meta.purpose)}`
      : `Observed records only. Not market share. Final pricing and submission remain human decisions. DO_NOT_USE excluded unless retrospective purpose. ${eligibilityLimitation(meta.purpose)}`,
    insufficient,
    evidenceHits: hits,
    reportRunId: null,
  };
  if (opts?.persist !== false) {
    const { persistReportRun } = await import("@/lib/reports/persist-run");
    report.reportRunId = await persistReportRun(report, {
      query: opts?.query ?? null,
      opportunityId: opts?.opportunityId ?? null,
      parentReportRunId: opts?.parentReportRunId ?? null,
    });
  }
  return report;
}
