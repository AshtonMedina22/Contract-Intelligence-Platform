/**
 * P5 — the pursuit Overview bundle.
 *
 * One RLS-scoped read of everything the Overview answers: what this is, when it is due, what is
 * required, how it is scored, whether we are bidding, who the buyer is, who else is bidding, what
 * L&P has done before, what is risky, whether we are compliance-ready, what the evidence supports,
 * and what to do next.
 *
 * All queries run through the request-scoped Supabase client, so tenancy is enforced by RLS rather
 * than by a filter in this file. Absent rows stay absent — nothing here substitutes a default for a
 * value the corpus does not hold.
 */

import { createClient } from "@/lib/supabase/server";
import {
  loadOpportunityHeader,
  loadWorkspaceSummary,
  loadPricingLines,
  loadCostModels,
  loadStaffingRequirements,
  collectFactIdsFromPricingLines,
  loadFactDocumentMap,
  type OpportunityHeader,
  type WorkspaceSummary,
  type StaffingRequirementRow,
} from "./load-workspace";
import { loadRequirementMatrix, loadRequirementResponses } from "./load-response";
import { computeResponseProgress, type ResponseProgress } from "./response";
import {
  listProposalPacketGaps,
  computeFulfillmentEconomics,
  type PacketGap,
  type FulfillmentEconomics,
} from "./proposal-packet";
import { loadPursuitIntelSummary, type PursuitIntelSummary } from "@/lib/intelligence/load-corpus";
import { searchVerifiedKnowledge } from "@/lib/retrieval/search";
import type { PricingLineRow, PricingCostModelRow } from "./types";
import {
  rollupRequirements,
  auditEvaluationWeights,
  readEvaluationScores,
  computeComplianceReadiness,
  buildBidStrategy,
  buildNextActions,
  type RequirementRollup,
  type EvaluationCriterionInput,
  type EvaluationScoreInput,
  type EvaluationWeightAudit,
  type EvaluationScoreReading,
  type ComplianceItemInput,
  type ComplianceMatchInput,
  type ComplianceReadiness,
  type BidStrategy,
  type NextAction,
} from "./overview-model";

export type SolicitationRow = {
  id: string;
  title: string;
  solicitation_number: string | null;
  source_document_id: string | null;
  created_at: string;
};

export type PublicSourceRow = {
  id: string;
  provider: string;
  title: string;
  buyer_name: string | null;
  solicitation_number: string | null;
  posted_on: string | null;
  due_on: string | null;
  source_url: string | null;
  estimated_value: number | null;
};

export type PublicProvenance = {
  provider: string | null;
  externalId: string | null;
  sourceUrl: string | null;
  publicSource: PublicSourceRow | null;
};

export type AwardRow = {
  notice: string | null;
  awarded_on: string | null;
  amount_nte: number | null;
  winner_name: string | null;
  source_document_id: string | null;
};

export type CompetitorBidRow = {
  name: string;
  quoted_amount: number | null;
  rank: number | null;
  note: string | null;
  source_url: string | null;
  source_document_id: string | null;
};

export type BuyerContractRow = {
  id: string;
  title: string;
  contract_number: string | null;
  verified_end_on: string | null;
};

export type BuyerHistory = {
  clientId: string | null;
  name: string | null;
  otherPursuits: {
    id: string;
    title: string;
    stage: string;
    go_no_go: string;
    response_due_on: string | null;
  }[];
  contracts: BuyerContractRow[];
  awardCount: number;
  winLossCount: number;
};

export type ResearchDigest = {
  count: number;
  recent: {
    id: string;
    title: string | null;
    source_url: string;
    verification_status: string;
    published_on: string | null;
  }[];
};

export type PriorExperience = {
  serviceType: string | null;
  sameBuyerContracts: BuyerContractRow[];
  sameServicePursuits: { id: string; title: string; client_name: string | null; stage: string }[];
};

export type OverviewBundle = {
  opportunityId: string;
  opportunity: OpportunityHeader;
  summary: WorkspaceSummary;
  provenance: PublicProvenance | null;
  solicitations: SolicitationRow[];
  staffing: StaffingRequirementRow[];
  pricingLines: PricingLineRow[];
  costModels: PricingCostModelRow[];
  factDocumentMap: Map<string, string>;
  economics: FulfillmentEconomics;
  gaps: PacketGap[];
  requirements: RequirementRollup;
  responseProgress: ResponseProgress | null;
  evaluationCriteria: EvaluationCriterionInput[];
  evaluationAudit: EvaluationWeightAudit;
  evaluationReading: EvaluationScoreReading;
  intel: PursuitIntelSummary;
  award: AwardRow | null;
  competitorBids: CompetitorBidRow[];
  buyer: BuyerHistory;
  research: ResearchDigest;
  priorExperience: PriorExperience;
  compliance: ComplianceReadiness;
  bidStrategy: BidStrategy;
  nextActions: NextAction[];
  unverifiedFactCount: number;
  conflictFactCount: number;
  linkedContractId: string | null;
  submissionSubmittedAt: string | null;
  narrativeError: string | null;
};

export async function loadOverviewBundle(opportunityId: string): Promise<OverviewBundle | null> {
  const opportunity = await loadOpportunityHeader(opportunityId);
  if (!opportunity) return null;

  const supabase = await createClient();
  const clientId = opportunity.client_id;

  const [
    summary,
    pricingLines,
    costModels,
    staffing,
    intel,
    requirementRows,
    requirementResponses,
    solicitations,
    evaluationCriteria,
    evaluationScoreRows,
    competitorBids,
    award,
    linkedContractId,
    submissionSubmittedAt,
    documentIds,
    publicSource,
    buyer,
    research,
    sameServicePursuits,
    narrative,
  ] = await Promise.all([
    loadWorkspaceSummary(opportunityId),
    loadPricingLines(opportunityId),
    loadCostModels(opportunityId),
    loadStaffingRequirements(opportunityId),
    loadPursuitIntelSummary(opportunityId),
    loadRequirementMatrix(opportunityId),
    loadRequirementResponses(opportunityId),
    supabase
      .from("solicitations")
      .select("id, title, solicitation_number, source_document_id, created_at")
      .eq("opportunity_id", opportunityId)
      .order("created_at")
      .then(({ data }) => (data ?? []) as SolicitationRow[]),
    supabase
      .from("evaluation_criteria")
      .select("id, criterion, weight_pct, notes, source_fact_id")
      .eq("opportunity_id", opportunityId)
      .order("weight_pct", { ascending: false, nullsFirst: false })
      .then(({ data }) => (data ?? []) as EvaluationCriterionInput[]),
    supabase
      .from("evaluation_scores")
      .select("respondent_name, points, max_points, rank, notes, source_document_id")
      .eq("opportunity_id", opportunityId)
      .order("points", { ascending: false, nullsFirst: false })
      .then(({ data }) => (data ?? []) as EvaluationScoreInput[]),
    supabase
      .from("competitor_bids")
      .select("quoted_amount, rank, note, source_url, source_document_id, competitors(name)")
      .eq("opportunity_id", opportunityId)
      .order("rank", { ascending: true, nullsFirst: false })
      .then(({ data }) =>
        (data ?? []).map((bid): CompetitorBidRow => {
          const competitor = Array.isArray(bid.competitors) ? bid.competitors[0] : bid.competitors;
          return {
            name: competitor?.name ?? "Unnamed competitor",
            quoted_amount: bid.quoted_amount,
            rank: bid.rank,
            note: bid.note,
            source_url: bid.source_url,
            source_document_id: bid.source_document_id,
          };
        }),
      ),
    supabase
      .from("awards")
      .select("notice, awarded_on, amount_nte, winner_name, source_document_id")
      .eq("opportunity_id", opportunityId)
      .maybeSingle()
      .then(({ data }) => (data as AwardRow | null) ?? null),
    supabase
      .from("contracts")
      .select("id")
      .eq("opportunity_id", opportunityId)
      .limit(1)
      .then(({ data }) => (data ?? [])[0]?.id ?? null),
    supabase
      .from("submission_packets")
      .select("submitted_at")
      .eq("opportunity_id", opportunityId)
      .maybeSingle()
      .then(({ data }) => data?.submitted_at ?? null),
    supabase
      .from("documents")
      .select("id")
      .eq("opportunity_id", opportunityId)
      .then(({ data }) => (data ?? []).map((d) => d.id)),
    loadPublicSource(opportunity.public_source_id),
    loadBuyerHistory(opportunityId, clientId, opportunity.client_name),
    loadResearchDigest(clientId),
    loadSameServicePursuits(opportunityId, opportunity.service_type),
    searchVerifiedKnowledge({
      query: [opportunity.client_name, opportunity.title, opportunity.service_type, "requirements evaluation pricing"]
        .filter(Boolean)
        .join(" "),
      purpose: "BID_STRATEGY",
      opportunityId,
      limit: 6,
    }),
  ]);

  const [factCounts, complianceItems, factDocumentMap, complianceMatches] = await Promise.all([
    loadFactCounts(documentIds),
    loadComplianceItems(linkedContractId),
    loadFactDocumentMap(collectFactIdsFromPricingLines(pricingLines)),
    loadComplianceMatches(opportunityId),
  ]);

  const requirements = rollupRequirements(requirementRows);
  const evaluationAudit = auditEvaluationWeights(evaluationCriteria);
  const evaluationReading = readEvaluationScores(evaluationScoreRows);
  const responseProgress =
    requirementRows.length > 0 ? computeResponseProgress(requirementRows, requirementResponses) : null;

  const gaps = listProposalPacketGaps({
    clientName: opportunity.client_name,
    procurementRail: opportunity.procurement_rail,
    solicitationKind: opportunity.solicitation_kind,
    responseDueOn: opportunity.response_due_on,
    serviceType: opportunity.service_type,
    siteLocation: opportunity.site_location,
    submissionMethod: opportunity.submission_method,
    coverageStartOn: opportunity.coverage_start_on,
    vehicleRef: opportunity.vehicle_ref,
    goNoGo: opportunity.go_no_go,
    documentCount: summary.documentCount,
    requirementCount: summary.requirementCount,
    evaluationCount: summary.evaluationCount,
    staffingCount: summary.staffingCount,
    staffingHoursEntered: staffing.some((s) => s.weekly_hours != null && Number(s.weekly_hours) > 0),
    pricingLineCount: summary.pricingLineCount,
    costModelCount: summary.costModelCount,
    competitorBidCount: summary.competitorBidCount,
    hasWinLoss: summary.hasWinLoss,
  });

  const compliance = computeComplianceReadiness({
    contractId: linkedContractId,
    items: complianceItems,
    today: new Date().toISOString().slice(0, 10),
    matches: complianceMatches,
  });

  const bidStrategy = buildBidStrategy({
    opportunityId,
    buyerName: opportunity.client_name,
    solicitationNumbers: solicitations.map((s) => s.solicitation_number ?? s.title),
    solicitationDocumentIds: solicitations.map((s) => s.source_document_id),
    requirements,
    evaluationAudit,
    evaluationReading,
    competitorBids,
    buyerHistory: {
      pursuitCount: buyer.otherPursuits.length,
      awardCount: buyer.awardCount,
      contractCount: buyer.contracts.length,
      winLossCount: buyer.winLossCount,
    },
    narrativeHits: narrative.hits.map((hit) => ({
      document_id: hit.document_id,
      source_page: hit.source_page,
      reuse_status: hit.reuse_status,
      content: hit.content,
    })),
    packetBlockingGapCount: gaps.filter((g) => g.severity === "block").length,
  });

  const nextActions = buildNextActions({
    opportunityId,
    documentCount: summary.documentCount,
    requirements,
    evaluationCriteriaCount: evaluationCriteria.length,
    pricingLineCount: summary.pricingLineCount,
    costModelCount: summary.costModelCount,
    responseProgress,
    submissionSubmitted: Boolean(submissionSubmittedAt),
    hasResult: summary.hasAward || summary.hasWinLoss,
    unverifiedFactCount: factCounts.unverified,
  });

  return {
    opportunityId,
    opportunity,
    summary,
    provenance: readProvenance(opportunity, publicSource),
    solicitations,
    staffing,
    pricingLines,
    costModels,
    factDocumentMap,
    economics: computeFulfillmentEconomics(staffing, costModels),
    gaps,
    requirements,
    responseProgress,
    evaluationCriteria,
    evaluationAudit,
    evaluationReading,
    intel,
    award,
    competitorBids,
    buyer,
    research,
    priorExperience: {
      serviceType: opportunity.service_type,
      sameBuyerContracts: buyer.contracts,
      sameServicePursuits,
    },
    compliance,
    bidStrategy,
    nextActions,
    unverifiedFactCount: factCounts.unverified,
    conflictFactCount: factCounts.conflict,
    linkedContractId,
    submissionSubmittedAt,
    narrativeError: narrative.error,
  };
}

function readProvenance(
  opportunity: OpportunityHeader,
  publicSource: PublicSourceRow | null,
): PublicProvenance | null {
  if (!publicSource && !opportunity.external_provider && !opportunity.source_url) return null;
  return {
    provider: opportunity.external_provider ?? publicSource?.provider ?? null,
    externalId: opportunity.external_source_id ?? null,
    sourceUrl: opportunity.source_url ?? publicSource?.source_url ?? null,
    publicSource,
  };
}

async function loadFactCounts(documentIds: string[]): Promise<{ unverified: number; conflict: number }> {
  if (documentIds.length === 0) return { unverified: 0, conflict: 0 };
  const supabase = await createClient();
  const [{ count: unverified }, { count: conflict }] = await Promise.all([
    supabase
      .from("extracted_facts")
      .select("id", { count: "exact", head: true })
      .in("document_id", documentIds)
      .in("verification_status", ["AI_EXTRACTED", "NEEDS_REVIEW"]),
    supabase
      .from("extracted_facts")
      .select("id", { count: "exact", head: true })
      .in("document_id", documentIds)
      .eq("verification_status", "CONFLICT"),
  ]);
  return { unverified: unverified ?? 0, conflict: conflict ?? 0 };
}

async function loadComplianceItems(contractId: string | null): Promise<ComplianceItemInput[]> {
  if (!contractId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("compliance_items")
    .select("id, kind, statement, expires_on, source_fact_id")
    .eq("contract_id", contractId)
    .order("expires_on", { ascending: true, nullsFirst: false });
  return (data ?? []) as ComplianceItemInput[];
}

async function loadComplianceMatches(opportunityId: string): Promise<ComplianceMatchInput[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("requirement_compliance_matches")
    .select("id, match_status, rationale, requirement_id")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as ComplianceMatchInput[];
}

async function loadPublicSource(publicSourceId: string | null): Promise<PublicSourceRow | null> {
  if (!publicSourceId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_sources")
    .select(
      "id, provider, title, buyer_name, solicitation_number, posted_on, due_on, source_url, estimated_value",
    )
    .eq("id", publicSourceId)
    .maybeSingle();
  return (data as PublicSourceRow | null) ?? null;
}

async function loadBuyerHistory(
  opportunityId: string,
  clientId: string | null,
  name: string | null,
): Promise<BuyerHistory> {
  if (!clientId) {
    return { clientId: null, name, otherPursuits: [], contracts: [], awardCount: 0, winLossCount: 0 };
  }

  const supabase = await createClient();
  const [{ data: pursuits }, { data: contracts }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, title, stage, go_no_go, response_due_on")
      .eq("client_id", clientId)
      .neq("id", opportunityId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("contracts")
      .select("id, title, contract_number, verified_end_on")
      .eq("client_id", clientId)
      .order("verified_end_on", { ascending: false, nullsFirst: false })
      .limit(8),
  ]);

  const pursuitIds = (pursuits ?? []).map((p) => p.id);
  let awardCount = 0;
  let winLossCount = 0;
  if (pursuitIds.length > 0) {
    const [{ count: awards }, { count: reviews }] = await Promise.all([
      supabase.from("awards").select("id", { count: "exact", head: true }).in("opportunity_id", pursuitIds),
      supabase
        .from("win_loss_reviews")
        .select("id", { count: "exact", head: true })
        .in("opportunity_id", pursuitIds),
    ]);
    awardCount = awards ?? 0;
    winLossCount = reviews ?? 0;
  }

  return {
    clientId,
    name,
    otherPursuits: pursuits ?? [],
    contracts: (contracts ?? []) as BuyerContractRow[],
    awardCount,
    winLossCount,
  };
}

/** research_facts carry the status they were stored with. Read never upgrades AI_EXTRACTED. */
async function loadResearchDigest(clientId: string | null): Promise<ResearchDigest> {
  if (!clientId) return { count: 0, recent: [] };
  const supabase = await createClient();
  const [{ count }, { data }] = await Promise.all([
    supabase.from("research_facts").select("id", { count: "exact", head: true }).eq("client_id", clientId),
    supabase
      .from("research_facts")
      .select("id, title, source_url, verification_status, published_on")
      .eq("client_id", clientId)
      .order("retrieved_at", { ascending: false })
      .limit(5),
  ]);
  return { count: count ?? 0, recent: data ?? [] };
}

async function loadSameServicePursuits(
  opportunityId: string,
  serviceType: string | null,
): Promise<PriorExperience["sameServicePursuits"]> {
  if (!serviceType) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("opportunities")
    .select("id, title, stage, clients(name)")
    .eq("service_type", serviceType)
    .neq("id", opportunityId)
    .order("created_at", { ascending: false })
    .limit(6);
  return (data ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    return { id: row.id, title: row.title, client_name: client?.name ?? null, stage: row.stage };
  });
}
