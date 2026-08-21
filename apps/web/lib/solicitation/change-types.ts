/**
 * F11 solicitation change-impact enums and shared types.
 * Detected changes start AI_EXTRACTED; material apply only after HUMAN_VERIFIED.
 */

export const SOLICITATION_CHANGE_TYPES = [
  "DEADLINE_CHANGE",
  "REQUIREMENT_ADDED",
  "REQUIREMENT_MODIFIED",
  "REQUIREMENT_REMOVED",
  "PRICING_CHANGE",
  "FORM_ADDED",
  "FORM_REMOVED",
  "EVALUATION_CHANGE",
  "SCOPE_CHANGE",
  "STAFFING_CHANGE",
  "COMPLIANCE_CHANGE",
  "SUBMISSION_METHOD_CHANGE",
  "Q_A_CLARIFICATION",
  "OTHER",
] as const;

export type SolicitationChangeType = (typeof SOLICITATION_CHANGE_TYPES)[number];

export const SOLICITATION_CHANGE_TRIGGER_KINDS = [
  "ADDENDUM",
  "Q_AND_A",
  "CLARIFICATION",
  "BASELINE",
] as const;

export type SolicitationChangeTriggerKind = (typeof SOLICITATION_CHANGE_TRIGGER_KINDS)[number];

export const SOLICITATION_CHANGE_RUN_STATUSES = [
  "AI_EXTRACTED",
  "NEEDS_REVIEW",
  "PARTIALLY_VERIFIED",
  "HUMAN_VERIFIED",
  "REJECTED",
  "APPLIED",
] as const;

export type SolicitationChangeRunStatus = (typeof SOLICITATION_CHANGE_RUN_STATUSES)[number];

export const DETECTOR_VERSION = "f11-heuristics-v1";

export function isSolicitationChangeType(value: string): value is SolicitationChangeType {
  return (SOLICITATION_CHANGE_TYPES as readonly string[]).includes(value);
}

/** Default impact flags by change type — advisory only. */
export function defaultImpactFlags(changeType: SolicitationChangeType): {
  responses: boolean;
  pricing: boolean;
  deadlines: boolean;
  checklist: boolean;
  readiness: boolean;
} {
  switch (changeType) {
    case "DEADLINE_CHANGE":
      return { responses: false, pricing: false, deadlines: true, checklist: true, readiness: true };
    case "REQUIREMENT_ADDED":
    case "REQUIREMENT_MODIFIED":
    case "REQUIREMENT_REMOVED":
      return { responses: true, pricing: false, deadlines: false, checklist: true, readiness: true };
    case "PRICING_CHANGE":
      return { responses: false, pricing: true, deadlines: false, checklist: true, readiness: true };
    case "FORM_ADDED":
    case "FORM_REMOVED":
      return { responses: false, pricing: false, deadlines: false, checklist: true, readiness: true };
    case "Q_A_CLARIFICATION":
      return { responses: true, pricing: false, deadlines: false, checklist: true, readiness: true };
    case "EVALUATION_CHANGE":
    case "SCOPE_CHANGE":
    case "STAFFING_CHANGE":
    case "COMPLIANCE_CHANGE":
    case "SUBMISSION_METHOD_CHANGE":
      return { responses: true, pricing: true, deadlines: false, checklist: true, readiness: true };
    default:
      return { responses: true, pricing: false, deadlines: false, checklist: true, readiness: true };
  }
}
