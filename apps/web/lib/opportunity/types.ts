export type OpportunityStage =
  | "INTAKE"
  | "ANALYSIS"
  | "PRICING"
  | "DRAFTING"
  | "SUBMITTED"
  | "AWARDED"
  | "CLOSED";

export type GoNoGo = "PENDING" | "GO" | "NO_GO";

export const OPPORTUNITY_STAGES: { value: OpportunityStage; label: string }[] = [
  { value: "INTAKE", label: "Intake" },
  { value: "ANALYSIS", label: "Analysis" },
  { value: "PRICING", label: "Pricing" },
  { value: "DRAFTING", label: "Drafting" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "AWARDED", label: "Awarded" },
  { value: "CLOSED", label: "Closed" },
];

export const GO_NO_GO_OPTIONS: { value: GoNoGo; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "GO", label: "Go" },
  { value: "NO_GO", label: "No bid" },
];

export const SERVICE_TYPE_SUGGESTIONS = [
  "Armed guards",
  "Unarmed guards",
  "Mobile patrol",
  "Executive protection",
  "Event security",
  "Construction site",
  "Government facility",
  "Access control / visitor management",
  "Off-duty / PPO",
] as const;

export type PricingCostModelRow = {
  id: string;
  labor_category: string;
  base_wage: number | null;
  fringe: number | null;
  health_welfare: number | null;
  burden_pct: number | null;
  workers_comp: number | null;
  insurance: number | null;
  supervision: number | null;
  equipment: number | null;
  vehicles: number | null;
  travel: number | null;
  overhead_pct: number | null;
  target_margin_pct: number | null;
  planned_proposed_rate: number | null;
  cost_floor: number | null;
  wage_determination_ref: string | null;
  notes: string | null;
};

export type PricingLineRow = {
  id: string;
  labor_category: string;
  rate_type: string | null;
  site_or_post: string | null;
  unit: string | null;
  quantity: number | null;
  extended_amount: number | null;
  requested_rate: number | null;
  internal_cost_rate: number | null;
  proposed_rate: number | null;
  awarded_rate: number | null;
  current_rate: number | null;
  requested_source_fact_id: string | null;
  proposed_source_fact_id: string | null;
  awarded_source_fact_id: string | null;
  current_source_fact_id: string | null;
};

export type PricingComparableRow = {
  id: string;
  opportunity_id: string;
  opportunity_title: string;
  client_name: string | null;
  service_type: string | null;
  labor_category: string;
  rate_type: string | null;
  unit: string | null;
  site_or_post: string | null;
  requested_rate: number | null;
  proposed_rate: number | null;
  awarded_rate: number | null;
  current_rate: number | null;
  requested_source_fact_id: string | null;
  proposed_source_fact_id: string | null;
  awarded_source_fact_id: string | null;
  current_source_fact_id: string | null;
  included: boolean;
  reason: string;
  match_basis: string;
  /** Last change to the source pricing line — recency for weighing a comparable. */
  updated_at: string | null;
  engine_score: number;
  structured_score: number;
  semantic_supplement: number;
  algorithm_version: string;
  judgment_source: "HUMAN" | "ENGINE_PROPOSAL";
};

export type PricingDecisionRow = {
  id: string;
  opportunity_id: string;
  labor_category: string | null;
  pricing_line_id: string | null;
  final_bid_rate: number | null;
  final_bid_amount: number | null;
  cost_floor: number | null;
  target_margin_pct: number | null;
  observed_min: number | null;
  observed_max: number | null;
  observed_median: number | null;
  observed_n: number;
  confidence: string | null;
  data_sufficiency: string | null;
  include_summary: string | null;
  exclude_summary: string | null;
  rationale: string | null;
  status: "DRAFT" | "HUMAN_APPROVED";
  decided_by: string | null;
  decided_at: string | null;
};

export const PRICING_STRUCTURE_HINTS = [
  "hourly",
  "labor category",
  "component build-up",
  "site/post/shift",
  "daily/weekly/monthly/annual",
  "fixed fee",
  "NTE",
  "base/options",
  "escalation",
  "OT",
  "holiday",
  "vehicles/equipment",
  "travel/reimbursables",
] as const;
