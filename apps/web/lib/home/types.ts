/**
 * Executive Home / Action Center types.
 * All metrics are real counts from Supabase RLS-scoped queries — no fake fallbacks.
 */

// KPI strip metrics — only metrics that can be honestly computed from the schema
export type HomeKpi = {
  // MUST IMPLEMENT metrics
  activePursuits: number;
  pursuitsDueSoon: number; // response_due_on within 14 days
  verificationBacklog: number; // facts: AI_EXTRACTED | NEEDS_REVIEW | CONFLICT
  processingFailures: number; // documents: FAILED or lifecycle_error NOT NULL
  openExceptions: number; // validation_exceptions: resolved = false
  contractsInReviewWindow: number; // contract_alerts count

  // OPTIONAL metrics (null if not computable)
  lpInputRequired: number | null; // requirements with matrix_status = 'L_AND_P_INPUT_REQUIRED'
  pricingDraftDecisions: number | null; // pricing_decisions with status = 'DRAFT'
  approvalsRequested: number | null; // pursuit_approval_layers with status = 'requested' and enabled = true
  activeContracts: number | null; // contracts with verified_end_on > today OR no alert bucket EXPIRED
};

// Needs attention queue item
export type AttentionItem = {
  id: string;
  priority: "urgent" | "high" | "medium" | "low";
  category:
    | "due_pursuit"
    | "verification"
    | "processing"
    | "exception"
    | "renewal"
    | "input_required"
    | "pricing"
    | "approval";
  title: string;
  context: string; // e.g. "Due in 3 days" or "12 facts pending"
  href: string;
};

// Active pursuit row for pipeline table
export type PipelinePursuit = {
  id: string;
  title: string;
  stage: string;
  clientName: string | null;
  responseDueOn: string | null;
  /** Only shown if HUMAN_APPROVED verified amount exists — else null */
  verifiedAmount: number | null;
};

// Win/loss snapshot
export type WinLossSnapshot = {
  wonCount: number;
  lostCount: number;
  pendingCount: number;
  cancelledCount: number;
  noBidCount: number;
  noAwardCount: number;
  recentOutcomes: Array<{
    id: string;
    opportunityId: string;
    opportunityTitle: string;
    outcome: string;
    winnerName: string | null;
  }>;
};

// Contract alert bucket counts
export type ContractAlertBuckets = {
  "180": number;
  "120": number;
  "90": number;
  "60": number;
  "30": number;
  EXPIRED: number;
};

// Market/competitor snapshot
export type MarketSnapshot = {
  clientCount: number;
  competitorCount: number;
};

/** Persisted open notifications / automation mirrors for Home. */
export type HomeNotification = {
  id: string;
  title: string;
  body: string | null;
  deepLink: string | null;
  severity: string;
  channel: string;
  status: string;
  createdAt: string;
};

// Full action center data
export type ActionCenterData = {
  kpi: HomeKpi;
  attentionItems: AttentionItem[];
  pipeline: PipelinePursuit[];
  winLoss: WinLossSnapshot;
  contractAlerts: ContractAlertBuckets;
  market: MarketSnapshot;
  notifications: HomeNotification[];
};
