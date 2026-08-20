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
  burden_pct: number | null;
  workers_comp: number | null;
  insurance: number | null;
  supervision: number | null;
  equipment: number | null;
  overhead_pct: number | null;
  target_margin_pct: number | null;
  planned_proposed_rate: number | null;
  notes: string | null;
};

export type PricingLineRow = {
  id: string;
  labor_category: string;
  requested_rate: number | null;
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
  requested_rate: number | null;
  proposed_rate: number | null;
  awarded_rate: number | null;
  current_rate: number | null;
  proposed_source_fact_id: string | null;
};
