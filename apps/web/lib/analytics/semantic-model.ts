/**
 * F6 governed semantic model — WrenAI pattern without the Wren stack.
 *
 * Metrics are parameterized definitions. Ask never invents SQL against the DB;
 * it picks a registered metricId and runs the query builder under org RLS.
 *
 * market_share is NEVER registered.
 */

import { MIN_WIN_RATE_SAMPLE } from "@/lib/intelligence/observations";

export type EntityId =
  | "pursuit"
  | "buyer"
  | "competitor"
  | "award"
  | "contract"
  | "pricing_line"
  | "outcome"
  | "requirement"
  | "proposal"
  | "compliance";

export type MetricSupport = "supported" | "withhold" | "refuse";

export type NullPolicy = "exclude" | "count_as_zero" | "withhold_if_any_null" | "n_a";

export type MetricDefinition = {
  id: string;
  label: string;
  definition: string;
  entity: EntityId;
  /** Tables read under RLS (never joined outside APPROVED_JOINS). */
  tables: readonly string[];
  eligibleStatuses: readonly string[] | null;
  dateField: string | null;
  grain: string;
  nullPolicy: NullPolicy;
  support: MetricSupport;
  withholdReason: string | null;
  dimensions: readonly string[];
  minSample?: number;
};

/** Canonical entity → primary table mapping. */
export const ENTITIES: Record<
  EntityId,
  { label: string; table: string; description: string }
> = {
  pursuit: {
    label: "Pursuit / opportunity",
    table: "opportunities",
    description: "Org pursuits (opportunities). Stage is workflow, not outcome.",
  },
  buyer: {
    label: "Buyer / client",
    table: "clients",
    description: "Procurement buyers/agencies — not CRM accounts.",
  },
  competitor: {
    label: "Competitor",
    table: "competitors",
    description: "Named competitors observed in verified corpus / bids.",
  },
  award: {
    label: "Award",
    table: "awards",
    description: "Award notices linked to opportunities (amount_nte when recorded).",
  },
  contract: {
    label: "Contract",
    table: "contracts",
    description: "L&P-held contracts; expiration from verified_end_on only.",
  },
  pricing_line: {
    label: "PricingLine",
    table: "pricing_lines",
    description: "Four-truth pricing lines; awarded_rate never mixed with proposed/current.",
  },
  outcome: {
    label: "Outcome / win_loss_review",
    table: "win_loss_reviews",
    description: "Human-recorded outcomes. Win rate uses WON+LOST only.",
  },
  requirement: {
    label: "Requirement",
    table: "requirements",
    description: "Solicitation requirements matrix rows.",
  },
  proposal: {
    label: "Proposal / content",
    table: "proposal_sections",
    description: "Reusable proposal content sections with reuse_status.",
  },
  compliance: {
    label: "Compliance",
    table: "compliance_items",
    description: "Contract compliance items (insurance, license, etc.).",
  },
};

/**
 * Approved joins only. Fabricated joins outside this list are refused.
 * Format: fromEntity --[fk]--> toEntity
 */
export const APPROVED_JOINS: readonly {
  from: EntityId;
  to: EntityId;
  via: string;
  note: string;
}[] = [
  {
    from: "pursuit",
    to: "buyer",
    via: "opportunities.client_id → clients.id",
    note: "Buyer on pursuit",
  },
  {
    from: "pursuit",
    to: "outcome",
    via: "win_loss_reviews.opportunity_id → opportunities.id",
    note: "One outcome per pursuit",
  },
  {
    from: "pursuit",
    to: "award",
    via: "awards.opportunity_id → opportunities.id",
    note: "Award notice for pursuit",
  },
  {
    from: "pursuit",
    to: "pricing_line",
    via: "pricing_lines.opportunity_id → opportunities.id",
    note: "Pricing grain on pursuit",
  },
  {
    from: "pursuit",
    to: "requirement",
    via: "requirements via solicitations.opportunity_id",
    note: "Requirements through solicitation",
  },
  {
    from: "pursuit",
    to: "proposal",
    via: "proposal_sections.opportunity_id → opportunities.id",
    note: "Proposal sections on pursuit",
  },
  {
    from: "pursuit",
    to: "contract",
    via: "contracts.opportunity_id → opportunities.id",
    note: "Contract created from pursuit",
  },
  {
    from: "contract",
    to: "buyer",
    via: "contracts.client_id → clients.id",
    note: "Buyer on contract",
  },
  {
    from: "contract",
    to: "compliance",
    via: "compliance_items.contract_id → contracts.id",
    note: "Compliance on contract",
  },
  {
    from: "competitor",
    to: "pursuit",
    via: "competitor_bids.competitor_id + opportunity_id",
    note: "Observed bid appearances",
  },
  {
    from: "award",
    to: "buyer",
    via: "awards.opportunity_id → opportunities.client_id → clients",
    note: "Buyer via award's pursuit",
  },
];

export const FORBIDDEN_METRIC_IDS = ["market_share", "marketShare", "share_of_market"] as const;

export const METRICS: readonly MetricDefinition[] = [
  {
    id: "pursuit_count",
    label: "Pursuit count",
    definition: "Count of opportunities (pursuits) in the tenant under RLS.",
    entity: "pursuit",
    tables: ["opportunities"],
    eligibleStatuses: null,
    dateField: "created_at",
    grain: "opportunity",
    nullPolicy: "exclude",
    support: "supported",
    withholdReason: null,
    dimensions: ["stage", "service_type", "client_id", "buyer_name"],
  },
  {
    id: "submitted_count",
    label: "Submitted count",
    definition:
      "Count of pursuits at stage SUBMITTED, or with a submission_packets.submitted_at recorded.",
    entity: "pursuit",
    tables: ["opportunities", "submission_packets"],
    eligibleStatuses: ["SUBMITTED"],
    dateField: "submitted_at",
    grain: "opportunity",
    nullPolicy: "exclude",
    support: "supported",
    withholdReason: null,
    dimensions: ["service_type", "client_id", "buyer_name"],
  },
  {
    id: "won_count",
    label: "Won count",
    definition: "Count of win_loss_reviews with outcome = WON.",
    entity: "outcome",
    tables: ["win_loss_reviews"],
    eligibleStatuses: ["WON"],
    dateField: "updated_at",
    grain: "opportunity",
    nullPolicy: "exclude",
    support: "supported",
    withholdReason: null,
    dimensions: ["client_id", "buyer_name", "service_type"],
  },
  {
    id: "lost_count",
    label: "Lost count",
    definition: "Count of win_loss_reviews with outcome = LOST.",
    entity: "outcome",
    tables: ["win_loss_reviews"],
    eligibleStatuses: ["LOST"],
    dateField: "updated_at",
    grain: "opportunity",
    nullPolicy: "exclude",
    support: "supported",
    withholdReason: null,
    dimensions: ["client_id", "buyer_name", "service_type"],
  },
  {
    id: "win_rate_decided",
    label: "Win rate (decided)",
    definition: `WON ÷ (WON + LOST) over win_loss_reviews. NO_BID, CANCELLED, NO_AWARD, PENDING excluded. Rate withheld when decided n < ${MIN_WIN_RATE_SAMPLE} (P9 gate).`,
    entity: "outcome",
    tables: ["win_loss_reviews"],
    eligibleStatuses: ["WON", "LOST"],
    dateField: "updated_at",
    grain: "opportunity (decided outcomes)",
    nullPolicy: "exclude",
    support: "supported",
    withholdReason: null,
    dimensions: ["client_id", "buyer_name", "service_type"],
    minSample: MIN_WIN_RATE_SAMPLE,
  },
  {
    id: "submitted_value",
    label: "Submitted value",
    definition:
      "Sum of submitted bid dollars. No verifiable submitted-value grain exists on opportunities or submission_packets.",
    entity: "pursuit",
    tables: ["opportunities", "submission_packets"],
    eligibleStatuses: ["SUBMITTED"],
    dateField: "submitted_at",
    grain: "none — unsupported",
    nullPolicy: "n_a",
    support: "withhold",
    withholdReason:
      "submitted_value is withheld: there is no verified submitted-dollar column on pursuits or submission packets. Do not invent a total from pricing_lines.proposed_rate.",
    dimensions: [],
  },
  {
    id: "awarded_value",
    label: "Awarded value",
    definition:
      "Sum of awards.amount_nte when every in-scope award has a non-null amount_nte; otherwise withhold (partial sum would read as complete).",
    entity: "award",
    tables: ["awards"],
    eligibleStatuses: null,
    dateField: "awarded_on",
    grain: "award (amount_nte)",
    nullPolicy: "withhold_if_any_null",
    support: "supported",
    withholdReason: null,
    dimensions: ["client_id", "buyer_name", "awarded_on"],
  },
  {
    id: "active_contract_value",
    label: "Active contract value",
    definition:
      "Portfolio active-contract dollars. Schema has no contract-value column; P10 withholds unless every active instrument has a recorded NTE/PO.",
    entity: "contract",
    tables: ["contracts", "awards", "purchase_orders"],
    eligibleStatuses: null,
    dateField: "verified_end_on",
    grain: "unsupported on contracts table",
    nullPolicy: "n_a",
    support: "withhold",
    withholdReason:
      "active_contract_value is withheld (P10 style): contracts have no value column; a portfolio total is only shown when every in-scope active contract has a recorded award NTE or PO — Ask does not invent that sum here.",
    dimensions: [],
  },
  {
    id: "recompete_win_rate",
    label: "Recompete win rate",
    definition: `Among pursuits with rebid_from_contract_id or rebid_from_opportunity_id set, WON ÷ (WON + LOST). Withheld when decided n < ${MIN_WIN_RATE_SAMPLE}.`,
    entity: "outcome",
    tables: ["opportunities", "win_loss_reviews"],
    eligibleStatuses: ["WON", "LOST"],
    dateField: "updated_at",
    grain: "rebid-linked opportunity",
    nullPolicy: "exclude",
    support: "supported",
    withholdReason: null,
    dimensions: ["client_id", "buyer_name"],
    minSample: MIN_WIN_RATE_SAMPLE,
  },
  {
    id: "median_awarded_rate",
    label: "Median awarded rate",
    definition:
      "Median of pricing_lines.awarded_rate for lines with non-null awarded_rate. Requires a single hourly unit grain; mixed hourly/non-hourly grains are refused.",
    entity: "pricing_line",
    tables: ["pricing_lines"],
    eligibleStatuses: null,
    dateField: "updated_at",
    grain: "hourly pricing_line (unit)",
    nullPolicy: "exclude",
    support: "supported",
    withholdReason: null,
    dimensions: ["labor_category", "unit", "client_id", "buyer_name"],
  },
  {
    id: "contract_expiration_count",
    label: "Contract expiration count",
    definition:
      "Count of contracts with verified_end_on falling in a window or alert bucket (180/120/90/60/30/EXPIRED). Undated contracts never assumed.",
    entity: "contract",
    tables: ["contracts", "contract_alerts"],
    eligibleStatuses: null,
    dateField: "verified_end_on",
    grain: "contract × bucket/window",
    nullPolicy: "exclude",
    support: "supported",
    withholdReason: null,
    dimensions: ["bucket", "window_days", "client_id", "buyer_name"],
  },
  {
    id: "competitor_frequency",
    label: "Competitor frequency",
    definition:
      "Count of competitor_bids rows per competitor (observed appearances in the corpus). Not market share.",
    entity: "competitor",
    tables: ["competitor_bids", "competitors"],
    eligibleStatuses: null,
    dateField: "created_at",
    grain: "competitor_bid appearance",
    nullPolicy: "exclude",
    support: "supported",
    withholdReason: null,
    dimensions: ["competitor_id", "competitor_name"],
  },
];

const BY_ID = new Map(METRICS.map((m) => [m.id, m]));

export function getMetric(id: string): MetricDefinition | undefined {
  return BY_ID.get(id);
}

export function listMetricIds(): string[] {
  return METRICS.map((m) => m.id);
}

export function isForbiddenMetricId(id: string): boolean {
  const lower = id.trim().toLowerCase();
  return FORBIDDEN_METRIC_IDS.some((f) => f.toLowerCase() === lower) || lower.includes("market_share");
}

export function isApprovedJoin(from: EntityId, to: EntityId): boolean {
  return APPROVED_JOINS.some(
    (j) => (j.from === from && j.to === to) || (j.from === to && j.to === from),
  );
}

export function assertJoinAllowed(from: EntityId, to: EntityId): { ok: true } | { ok: false; message: string } {
  if (isApprovedJoin(from, to)) return { ok: true };
  return {
    ok: false,
    message: `Join ${from}↔${to} is not in the approved join registry. Fabricated joins are refused.`,
  };
}

/** Tables the validator may see referenced in defensive raw-SQL checks. */
export const ALLOWED_SQL_TABLES = [
  ...new Set([
    ...Object.values(ENTITIES).map((e) => e.table),
    "submission_packets",
    "competitor_bids",
    "contract_alerts",
    "purchase_orders",
    "solicitations",
    "analytical_runs",
  ]),
] as const;
