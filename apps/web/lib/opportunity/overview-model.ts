/**
 * P5 — pure derivation for the pursuit Overview.
 *
 * Every function here turns rows the operator can click through to into counts, buckets, and cited
 * bullets. Nothing infers a value that was not recorded: absent data becomes an explicit Unknown or
 * an INSUFFICIENT state with the reason attached, never a filled-in guess.
 *
 * Kept free of Supabase / React imports so the acceptance script can bundle and exercise it.
 */

import type { RequirementMatrixRow, RequirementMatrixStatus } from "./response";

export const REQUIREMENT_MATRIX_STATUSES: RequirementMatrixStatus[] = [
  "OPEN",
  "DRAFTING",
  "DRAFTED",
  "APPROVED",
  "L_AND_P_INPUT_REQUIRED",
];

export const REQUIREMENT_STATUS_LABELS: Record<RequirementMatrixStatus, string> = {
  OPEN: "Open",
  DRAFTING: "Drafting",
  DRAFTED: "Drafted",
  APPROVED: "Approved",
  L_AND_P_INPUT_REQUIRED: "L&P INPUT REQUIRED",
};

export type RequirementRollup = {
  total: number;
  byStatus: Record<RequirementMatrixStatus, number>;
  mandatory: number;
  scored: number;
  sourced: number;
  unsourced: number;
  responseRequired: number;
  attachmentRequired: number;
  formNames: string[];
};

/** Counts only. Never treats an unsourced requirement as verified. */
export function rollupRequirements(rows: RequirementMatrixRow[]): RequirementRollup {
  const byStatus = {
    OPEN: 0,
    DRAFTING: 0,
    DRAFTED: 0,
    APPROVED: 0,
    L_AND_P_INPUT_REQUIRED: 0,
  } as Record<RequirementMatrixStatus, number>;

  let mandatory = 0;
  let scored = 0;
  let sourced = 0;
  let responseRequired = 0;
  let attachmentRequired = 0;
  const formNames = new Set<string>();

  for (const row of rows) {
    if (byStatus[row.matrix_status] === undefined) byStatus[row.matrix_status] = 0;
    byStatus[row.matrix_status] += 1;
    if (row.mandatory) mandatory += 1;
    if (row.scored) scored += 1;
    if (row.source_fact_id) sourced += 1;
    if (row.response_required) responseRequired += 1;
    if (row.attachment_required) attachmentRequired += 1;
    const form = row.form_name?.trim();
    if (form) formNames.add(form);
  }

  return {
    total: rows.length,
    byStatus,
    mandatory,
    scored,
    sourced,
    unsourced: rows.length - sourced,
    responseRequired,
    attachmentRequired,
    formNames: [...formNames].sort(),
  };
}

export type EvaluationCriterionInput = {
  id: string;
  criterion: string;
  weight_pct: number | null;
  notes: string | null;
  source_fact_id: string | null;
};

export type EvaluationWeightAudit = {
  status: "NO_CRITERIA" | "NO_WEIGHTS" | "PARTIAL_WEIGHTS" | "SUMS_TO_100" | "DOES_NOT_SUM_TO_100";
  weightedCount: number;
  unweightedCount: number;
  weightTotal: number | null;
  message: string;
};

/**
 * Audits the weights the operator actually entered. Does not normalize, redistribute, or invent a
 * missing weight — a criterion with no weight stays unweighted and is reported as such.
 */
export function auditEvaluationWeights(criteria: EvaluationCriterionInput[]): EvaluationWeightAudit {
  if (criteria.length === 0) {
    return {
      status: "NO_CRITERIA",
      weightedCount: 0,
      unweightedCount: 0,
      weightTotal: null,
      message:
        "No evaluation criteria recorded. Nothing here states how this pursuit will be scored — extract Section M / bid factors from the solicitation.",
    };
  }

  const weighted = criteria.filter((c) => c.weight_pct != null && Number.isFinite(Number(c.weight_pct)));
  const unweightedCount = criteria.length - weighted.length;

  if (weighted.length === 0) {
    return {
      status: "NO_WEIGHTS",
      weightedCount: 0,
      unweightedCount,
      weightTotal: null,
      message: `${criteria.length} criterion(s) recorded with no weight on any of them. Scoring weight is unknown, not equal.`,
    };
  }

  const weightTotal = Math.round(weighted.reduce((sum, c) => sum + Number(c.weight_pct), 0) * 100) / 100;

  if (unweightedCount > 0) {
    return {
      status: "PARTIAL_WEIGHTS",
      weightedCount: weighted.length,
      unweightedCount,
      weightTotal,
      message: `Entered weights total ${weightTotal}% across ${weighted.length} criterion(s); ${unweightedCount} criterion(s) have no weight. The total is not a full scoring model.`,
    };
  }

  if (Math.abs(weightTotal - 100) < 0.01) {
    return {
      status: "SUMS_TO_100",
      weightedCount: weighted.length,
      unweightedCount: 0,
      weightTotal,
      message: `All ${weighted.length} criterion(s) are weighted and the entered weights total 100%.`,
    };
  }

  return {
    status: "DOES_NOT_SUM_TO_100",
    weightedCount: weighted.length,
    unweightedCount: 0,
    weightTotal,
    message: `Entered weights total ${weightTotal}%, not 100%. Either the solicitation does not use percentage weights or a criterion is missing — reconcile against the source before relying on this.`,
  };
}

export type EvaluationScoreInput = {
  respondent_name: string;
  points: number | null;
  max_points: number | null;
  rank: number | null;
  notes: string | null;
  source_document_id: string | null;
};

export type EvaluationScoreReading = {
  scores: (EvaluationScoreInput & { isLpMatch: boolean })[];
  anyMaxPoints: boolean;
  anyRank: boolean;
  lpMatchCount: number;
  lpPoints: number | null;
  higherThanLp: number | null;
  caveat: string;
};

const LP_NAME_PATTERNS = [/\bl\s*&\s*p\b/i, /\bl\s*and\s*p\b/i, /\blp\s+global\b/i];

/** Name-match only. Used for labelling; never treated as an authoritative respondent identity. */
export function looksLikeLpRespondent(name: string): boolean {
  return LP_NAME_PATTERNS.some((re) => re.test(name));
}

/**
 * Reads recorded scores verbatim. `higherThanLp` is arithmetic over recorded point values only and
 * is not a rank: official rank is reported as unknown unless the source recorded it.
 */
export function readEvaluationScores(rows: EvaluationScoreInput[]): EvaluationScoreReading {
  const scores = rows.map((r) => ({ ...r, isLpMatch: looksLikeLpRespondent(r.respondent_name) }));
  const anyMaxPoints = scores.some((s) => s.max_points != null);
  const anyRank = scores.some((s) => s.rank != null);
  const lpMatches = scores.filter((s) => s.isLpMatch);
  const lpPoints = lpMatches.length === 1 ? lpMatches[0].points : null;
  const higherThanLp =
    lpPoints == null
      ? null
      : scores.filter((s) => !s.isLpMatch && s.points != null && Number(s.points) > Number(lpPoints)).length;

  const caveats: string[] = [];
  if (!anyMaxPoints) caveats.push("maximum points not recorded");
  if (!anyRank) caveats.push("official rank not recorded");
  if (lpMatches.length > 1) caveats.push("more than one respondent name matches L&P");
  if (rows.length > 0 && lpMatches.length === 0) caveats.push("no respondent name matches L&P");

  return {
    scores,
    anyMaxPoints,
    anyRank,
    lpMatchCount: lpMatches.length,
    lpPoints,
    higherThanLp,
    caveat:
      caveats.length > 0
        ? `Recorded values only — ${caveats.join("; ")}. Point totals are not a scoring outcome.`
        : "Recorded values only.",
  };
}

export type ComplianceItemInput = {
  id: string;
  kind: string;
  statement: string;
  expires_on: string | null;
  source_fact_id: string | null;
};

export type ComplianceReadiness = {
  mode: "CONTRACT_LINKED" | "NO_CONTRACT_LINKED";
  contractId: string | null;
  buckets: { verified: number; expiring: number; missing: number; unknown: number };
  items: (ComplianceItemInput & { bucket: "verified" | "expiring" | "missing" | "unknown" })[];
  message: string;
};

export const COMPLIANCE_EXPIRING_WINDOW_DAYS = 60;

const NO_PURSUIT_COMPLIANCE_MESSAGE =
  "Pursuit-level compliance matrix not available — compliance items are tracked per contract. " +
  "See Contracts after award, or the required forms and attachments on Requirements / Submission for this pursuit.";

/**
 * Buckets recorded compliance items by their recorded expiry only. With no contract linked the answer
 * is Unknown for everything — the absence of items is not evidence of compliance.
 */
export function computeComplianceReadiness(input: {
  contractId: string | null;
  items: ComplianceItemInput[];
  today: string;
}): ComplianceReadiness {
  if (!input.contractId) {
    return {
      mode: "NO_CONTRACT_LINKED",
      contractId: null,
      buckets: { verified: 0, expiring: 0, missing: 0, unknown: 0 },
      items: [],
      message: NO_PURSUIT_COMPLIANCE_MESSAGE,
    };
  }

  const todayMs = Date.parse(input.today);
  const buckets = { verified: 0, expiring: 0, missing: 0, unknown: 0 };
  const items = input.items.map((item) => {
    let bucket: "verified" | "expiring" | "missing" | "unknown";
    const expiresMs = item.expires_on ? Date.parse(item.expires_on) : Number.NaN;
    if (!Number.isFinite(expiresMs) || !Number.isFinite(todayMs)) {
      bucket = "unknown";
    } else {
      const days = Math.floor((expiresMs - todayMs) / 86_400_000);
      if (days < 0) bucket = "missing";
      else if (days <= COMPLIANCE_EXPIRING_WINDOW_DAYS) bucket = "expiring";
      else bucket = "verified";
    }
    buckets[bucket] += 1;
    return { ...item, bucket };
  });

  return {
    mode: "CONTRACT_LINKED",
    contractId: input.contractId,
    buckets,
    items,
    message:
      items.length === 0
        ? "A contract is linked but it has no compliance items recorded. Readiness is Unknown, not compliant."
        : `Buckets from recorded expiry dates only. Expiring = within ${COMPLIANCE_EXPIRING_WINDOW_DAYS} days. Missing = recorded expiry already passed. Unknown = no expiry recorded.`,
  };
}

export type Citation = { label: string; href?: string };

export type EvidenceBullet = { id: string; text: string; citations: Citation[] };

export type BidStrategy = {
  status: "AVAILABLE" | "INSUFFICIENT";
  reason: string | null;
  bullets: EvidenceBullet[];
  withheld: string[];
};

export type BidStrategyInput = {
  opportunityId: string;
  buyerName: string | null;
  solicitationNumbers: string[];
  solicitationDocumentIds: (string | null)[];
  requirements: RequirementRollup;
  evaluationAudit: EvaluationWeightAudit;
  evaluationReading: EvaluationScoreReading;
  competitorBids: { name: string; quoted_amount: number | null; source_url: string | null; source_document_id: string | null }[];
  buyerHistory: { pursuitCount: number; awardCount: number; contractCount: number; winLossCount: number };
  narrativeHits: { document_id: string; source_page: number | null; reuse_status: string; content: string }[];
  packetBlockingGapCount: number;
};

const INSUFFICIENT_REASON =
  "Insufficient verified, pursuit-scoped evidence to state a bid strategy. Nothing below is asserted because nothing above supports it.";

/**
 * Assembles bid-strategy bullets from this pursuit's own records only. Each bullet carries at least
 * one citation the operator can open. No bullet is produced from an absent record, and no win theme,
 * probability, market share, or causal claim is generated.
 */
export function buildBidStrategy(input: BidStrategyInput): BidStrategy {
  const bullets: EvidenceBullet[] = [];
  const withheld: string[] = [];
  const requirementsHref = `/procurement/opportunities/${input.opportunityId}/requirements`;

  if (input.requirements.total > 0) {
    const parts = [`${input.requirements.total} requirement(s) captured`];
    if (input.requirements.mandatory > 0) parts.push(`${input.requirements.mandatory} mandatory`);
    if (input.requirements.sourced > 0) parts.push(`${input.requirements.sourced} carrying a source fact`);
    if (input.requirements.attachmentRequired > 0) {
      parts.push(`${input.requirements.attachmentRequired} needing an attachment`);
    }
    bullets.push({
      id: "requirements",
      text: `Response obligation: ${parts.join(", ")}. Compliance with these is what the response must cover.`,
      citations: [{ label: "Requirements matrix", href: requirementsHref }],
    });
  } else {
    withheld.push("No requirements captured — the response obligation is unknown.");
  }

  if (input.evaluationAudit.status !== "NO_CRITERIA") {
    bullets.push({
      id: "evaluation-criteria",
      text: `Award basis as recorded: ${input.evaluationAudit.message}`,
      citations: [{ label: "Evaluation criteria", href: requirementsHref }],
    });
  } else {
    withheld.push("No evaluation criteria recorded — the award basis is unknown.");
  }

  if (input.evaluationReading.scores.length > 0) {
    const docId = input.evaluationReading.scores.find((s) => s.source_document_id)?.source_document_id ?? null;
    const lpClause =
      input.evaluationReading.lpPoints != null && input.evaluationReading.higherThanLp != null
        ? ` L&P (matched by respondent name) is recorded at ${input.evaluationReading.lpPoints}, with ${input.evaluationReading.higherThanLp} respondent(s) recorded higher.`
        : "";
    bullets.push({
      id: "evaluation-scores",
      text: `${input.evaluationReading.scores.length} respondent score(s) recorded for this solicitation.${lpClause} ${input.evaluationReading.caveat}`,
      citations: docId
        ? [{ label: "Source document", href: `/ingestion/verification/${docId}` }]
        : [{ label: "evaluation_scores (this pursuit)" }],
    });
  } else {
    withheld.push("No respondent scores recorded for this solicitation.");
  }

  const sourcedBids = input.competitorBids.filter((b) => b.quoted_amount != null);
  if (sourcedBids.length > 0) {
    const amounts = sourcedBids.map((b) => Number(b.quoted_amount)).sort((a, b) => a - b);
    const median =
      amounts.length % 2 === 1
        ? amounts[(amounts.length - 1) / 2]
        : (amounts[amounts.length / 2 - 1] + amounts[amounts.length / 2]) / 2;
    const citations: Citation[] = sourcedBids
      .slice(0, 4)
      .map((b) =>
        b.source_url
          ? { label: `${b.name} — source`, href: b.source_url }
          : b.source_document_id
            ? { label: `${b.name} — document`, href: `/ingestion/verification/${b.source_document_id}` }
            : { label: `${b.name} — competitor_bids row` },
      );
    bullets.push({
      id: "competitor-amounts",
      text: `${sourcedBids.length} sourced competitor amount(s) on this pursuit: observed range ${amounts[0]} to ${amounts[amounts.length - 1]}, median ${median}. Observed quotes only — not a market rate and not a price recommendation.`,
      citations,
    });
  } else {
    withheld.push("No sourced competitor amounts on this pursuit — no observed price position.");
  }

  const history = input.buyerHistory;
  if (history.pursuitCount + history.awardCount + history.contractCount + history.winLossCount > 0) {
    bullets.push({
      id: "buyer-history",
      text: `Prior record with ${input.buyerName ?? "this buyer"}: ${history.pursuitCount} other pursuit(s), ${history.awardCount} award record(s), ${history.contractCount} contract(s), ${history.winLossCount} win/loss review(s). Counts of records held, not a win rate.`,
      citations: [{ label: "Buyer portfolio", href: "/intelligence/clients" }],
    });
  } else {
    withheld.push("No prior L&P record with this buyer in the corpus.");
  }

  if (input.narrativeHits.length > 0) {
    for (const [index, hit] of input.narrativeHits.slice(0, 3).entries()) {
      bullets.push({
        id: `narrative-${index}`,
        text: `Reusable verified passage (${hit.reuse_status}): “${hit.content.replace(/\s+/g, " ").trim().slice(0, 220)}”`,
        citations: [
          {
            label: hit.source_page != null ? `Source document p.${hit.source_page}` : "Source document",
            href: `/ingestion/verification/${hit.document_id}`,
          },
        ],
      });
    }
  } else {
    withheld.push("No verified narrative passages retrieved for this pursuit under BID_STRATEGY.");
  }

  if (input.packetBlockingGapCount > 0) {
    withheld.push(
      `${input.packetBlockingGapCount} blocking packet gap(s) remain — any strategy stays incomplete until those are filled.`,
    );
  }

  if (bullets.length === 0) {
    return { status: "INSUFFICIENT", reason: INSUFFICIENT_REASON, bullets: [], withheld };
  }

  return { status: "AVAILABLE", reason: null, bullets, withheld };
}

export type NextAction = { id: string; label: string; href: string; reason: string };

/** Deep links derived from what is actually missing. No action is suggested for a satisfied step. */
export function buildNextActions(input: {
  opportunityId: string;
  documentCount: number;
  requirements: RequirementRollup;
  evaluationCriteriaCount: number;
  pricingLineCount: number;
  costModelCount: number;
  responseProgress: { mandatoryOutstanding: number; lpInputRequired: number } | null;
  submissionSubmitted: boolean;
  hasResult: boolean;
  unverifiedFactCount: number;
}): NextAction[] {
  const base = `/procurement/opportunities/${input.opportunityId}`;
  const actions: NextAction[] = [];

  if (input.documentCount === 0) {
    actions.push({
      id: "intake",
      label: "Intake — upload the solicitation packet",
      href: `/ingestion/intake?opportunity=${input.opportunityId}`,
      reason: "No documents on this pursuit.",
    });
  }
  if (input.unverifiedFactCount > 0) {
    actions.push({
      id: "verification",
      label: "Verification — clear staged facts",
      href: "/ingestion/verification",
      reason: `${input.unverifiedFactCount} staged fact(s) awaiting human verification.`,
    });
  }
  if (input.requirements.total === 0) {
    actions.push({
      id: "requirements",
      label: "Requirements — capture the requirement matrix",
      href: `${base}/requirements`,
      reason: "No requirements captured.",
    });
  } else if (input.requirements.byStatus.L_AND_P_INPUT_REQUIRED > 0) {
    actions.push({
      id: "requirements-lp",
      label: "Requirements — resolve L&P INPUT REQUIRED rows",
      href: `${base}/requirements`,
      reason: `${input.requirements.byStatus.L_AND_P_INPUT_REQUIRED} requirement(s) need an L&P fact that does not exist yet.`,
    });
  }
  if (input.evaluationCriteriaCount === 0) {
    actions.push({
      id: "evaluation",
      label: "Requirements — record evaluation criteria",
      href: `${base}/requirements`,
      reason: "How this pursuit is scored is not recorded.",
    });
  }
  if (input.pricingLineCount === 0 && input.costModelCount === 0) {
    actions.push({
      id: "pricing",
      label: "Pricing — build the cost model",
      href: `${base}/pricing`,
      reason: "No verified pricing lines and no planning cost model.",
    });
  }
  if (input.responseProgress && input.responseProgress.mandatoryOutstanding > 0) {
    actions.push({
      id: "response",
      label: "Response — draft outstanding mandatory answers",
      href: `${base}/response`,
      reason: `${input.responseProgress.mandatoryOutstanding} mandatory requirement(s) have no draft.`,
    });
  }
  if (!input.submissionSubmitted) {
    actions.push({
      id: "submission",
      label: "Submission — work the packet checklist",
      href: `${base}/submission`,
      reason: "Submission is not recorded as sent.",
    });
  }
  if (!input.hasResult) {
    actions.push({
      id: "result",
      label: "Result — capture the outcome when it lands",
      href: `${base}/result`,
      reason: "No award or win/loss record on this pursuit.",
    });
  }

  return actions;
}
