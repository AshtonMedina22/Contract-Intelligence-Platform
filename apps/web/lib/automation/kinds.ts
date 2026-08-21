/**
 * F9 automation kinds + human-gate bans.
 * Pure module — no React / no Supabase.
 */

export const AUTOMATION_KINDS = [
  "pursuit_deadline",
  "questions_deadline",
  "mandatory_conference",
  "prebid_deadline",
  "pricing_approval_pending",
  "response_approval_pending",
  "lp_input_required_outstanding",
  "mandatory_requirement_outstanding",
  "submission_checklist_incomplete",
  "submission_deadline",
  "verification_backlog",
  "processing_failure",
  "compliance_expiration",
  "contract_review_window",
  "renewal_notice",
  "rebid_planning",
  "option_decision",
  "research_refresh",
  "daily_digest",
] as const;

export type AutomationKind = (typeof AUTOMATION_KINDS)[number];

/** Legacy Phase 6 / VERIFY6 kind — cleared and superseded by response_approval_pending. */
export const LEGACY_APPROVAL_REMINDER_KIND = "approval_reminder" as const;

/**
 * Actions automation must NEVER perform.
 * Grep target for acceptance: no approve/submit/renew/verify mutations in automation SQL.
 */
export const HUMAN_GATE_BANS = [
  "verify_evidence",
  "select_final_price",
  "approve_proposal",
  "submit_bid",
  "renew_contract",
  "exercise_option",
] as const;

export type HumanGateBan = (typeof HUMAN_GATE_BANS)[number];

export const HUMAN_GATE_BAN_NOTES: Record<HumanGateBan, string> = {
  verify_evidence: "Automation never promotes facts to HUMAN_VERIFIED.",
  select_final_price: "Automation never sets pricing_decisions to HUMAN_APPROVED.",
  approve_proposal: "Automation never approves proposals or go_no_go.",
  submit_bid: "Automation never marks packets submitted or posts to portals.",
  renew_contract: "Automation never renews contracts (CatalogIT reminder pattern only).",
  exercise_option: "Automation never exercises contract options.",
};

export function isAutomationKind(value: string): value is AutomationKind {
  return (AUTOMATION_KINDS as readonly string[]).includes(value);
}

export function isHumanGateBan(action: string): action is HumanGateBan {
  return (HUMAN_GATE_BANS as readonly string[]).includes(action);
}
