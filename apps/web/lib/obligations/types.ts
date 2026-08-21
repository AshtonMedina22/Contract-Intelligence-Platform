/**
 * F15 — Contract obligations types.
 * Contract-scoped only — not a generic task manager.
 */

export const OBLIGATION_TYPES = [
  "STAFFING",
  "SCHEDULE",
  "TRAINING",
  "REPORTING",
  "INCIDENT_REPORTING",
  "INSURANCE",
  "LICENSE",
  "EQUIPMENT",
  "INVOICE",
  "SERVICE_LEVEL",
  "MEETING",
  "AUDIT",
  "DELIVERABLE",
  "NOTICE",
  "OPTION",
  "RENEWAL",
  "OTHER",
] as const;

export type ObligationType = (typeof OBLIGATION_TYPES)[number];

export const OBLIGATION_STATUSES = [
  "NOT_STARTED",
  "UPCOMING",
  "DUE",
  "COMPLETED",
  "OVERDUE",
  "WAIVED",
  "SUPERSEDED",
] as const;

export type ObligationStatus = (typeof OBLIGATION_STATUSES)[number];

export const OBLIGATION_CRITICALITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type ObligationCriticality = (typeof OBLIGATION_CRITICALITIES)[number];

export type ObligationVerificationStatus =
  | "AI_EXTRACTED"
  | "PUBLIC_UNVERIFIED"
  | "HUMAN_VERIFIED"
  | "REJECTED"
  | "NEEDS_REVIEW";

/** Terminal statuses — never date-derived. */
export const TERMINAL_OBLIGATION_STATUSES: readonly ObligationStatus[] = [
  "COMPLETED",
  "WAIVED",
  "SUPERSEDED",
];

export function isTerminalObligationStatus(status: string): boolean {
  return (TERMINAL_OBLIGATION_STATUSES as readonly string[]).includes(status);
}

export function isObligationType(value: string): value is ObligationType {
  return (OBLIGATION_TYPES as readonly string[]).includes(value);
}

export type ContractObligation = {
  id: string;
  organization_id: string;
  contract_id: string;
  obligation_type: ObligationType | string;
  title: string;
  description: string | null;
  source_clause_ref: string | null;
  source_document_id: string | null;
  source_document_version_id: string | null;
  source_page: number | null;
  source_fact_id: string | null;
  owner_user_id: string | null;
  effective_on: string | null;
  due_on: string | null;
  recurrence_rule: string | null;
  next_due_on: string | null;
  status: ObligationStatus | string;
  criticality: ObligationCriticality | string;
  evidence_requirement_text: string | null;
  completion_evidence_document_id: string | null;
  completed_at: string | null;
  completed_by: string | null;
  waive_reason: string | null;
  superseded_by_id: string | null;
  amendment_id: string | null;
  verification_status: ObligationVerificationStatus | string;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export function hasObligationSource(row: {
  source_clause_ref?: string | null;
  source_document_id?: string | null;
  source_fact_id?: string | null;
}): boolean {
  return Boolean(
    (row.source_clause_ref && row.source_clause_ref.trim()) ||
      row.source_document_id ||
      row.source_fact_id,
  );
}

/** Completion evidence is operational proof — never a past-performance claim. */
export const COMPLETION_EVIDENCE_NOTE =
  "Completion evidence documents that an obligation was performed. It is not a qualitative past-performance claim (see F14 experience_records).";

export const OBLIGATIONS_NOT_TASK_MANAGER_NOTE =
  "Contract obligations only — not a generic task or work tracker.";
