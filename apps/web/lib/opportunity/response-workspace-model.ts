/**
 * P6 — Requirement-driven Response workspace model.
 *
 * Pure functions only: no Supabase, no React. The workspace UI and
 * `scripts/p6-response-workspace-acceptance.mjs` run the same code.
 *
 * These helpers decide what an operator may *do*; they never soften a Phase 8 trust rule.
 * The server actions remain the enforcing boundary.
 */

import {
  computeResponseProgress,
  isDraftingAllowedSource,
  type DraftStatus,
  type EvidenceState,
  type RequirementMatrixRow,
  type RequirementResponseRow,
  type ResponseProgress,
} from "./response";

// --------------------------------------------------------------------- states

export type RequirementWorkState = "APPROVED" | "INPUT_REQUIRED" | "REVIEW" | "TODO";

export const REQUIREMENT_WORK_STATE_LABELS: Record<RequirementWorkState, string> = {
  APPROVED: "Approved",
  INPUT_REQUIRED: "L&P input required",
  REVIEW: "Needs review",
  TODO: "To do",
};

export function draftHasContent(html: string | null | undefined): boolean {
  return (html ?? "").replace(/<[^>]+>/g, "").trim().length > 0;
}

/**
 * One bucket per requirement, in priority order. Approval wins over everything so an approved
 * response is never re-listed as outstanding work; L&P input required wins over review so a
 * requirement we cannot honestly answer is never presented as merely needing a read-through.
 */
export function requirementWorkState(
  req: RequirementMatrixRow,
  resp: RequirementResponseRow | undefined,
): RequirementWorkState {
  if (resp?.draft_status === "APPROVED" || req.matrix_status === "APPROVED") return "APPROVED";
  if (
    resp?.evidence_state === "L_AND_P_INPUT_REQUIRED" ||
    req.matrix_status === "L_AND_P_INPUT_REQUIRED"
  ) {
    return "INPUT_REQUIRED";
  }
  if (resp?.evidence_state === "REVIEW_REQUIRED" || draftHasContent(resp?.draft_html)) {
    return "REVIEW";
  }
  return "TODO";
}

// -------------------------------------------------------------------- filters

export type ResponseFilterKey =
  | "ALL"
  | "TODO"
  | "INPUT_REQUIRED"
  | "REVIEW"
  | "APPROVED"
  | "MANDATORY"
  | "SCORED";

export const RESPONSE_FILTERS: { key: ResponseFilterKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "TODO", label: "To Do" },
  { key: "INPUT_REQUIRED", label: "Input Required" },
  { key: "REVIEW", label: "Review" },
  { key: "APPROVED", label: "Approved" },
  { key: "MANDATORY", label: "Mandatory" },
  { key: "SCORED", label: "Scored" },
];

export function matchesResponseFilter(
  filter: ResponseFilterKey,
  req: RequirementMatrixRow,
  resp: RequirementResponseRow | undefined,
): boolean {
  if (filter === "ALL") return true;
  if (filter === "MANDATORY") return req.mandatory;
  if (filter === "SCORED") return req.scored;
  return requirementWorkState(req, resp) === filter;
}

export function responsesByRequirement(
  responses: RequirementResponseRow[],
): Map<string, RequirementResponseRow> {
  return new Map(responses.map((r) => [r.requirement_id, r]));
}

export function filterRequirements(
  requirements: RequirementMatrixRow[],
  responses: RequirementResponseRow[],
  filter: ResponseFilterKey,
): RequirementMatrixRow[] {
  const byReq = responsesByRequirement(responses);
  return requirements.filter((req) => matchesResponseFilter(filter, req, byReq.get(req.id)));
}

export function responseFilterCounts(
  requirements: RequirementMatrixRow[],
  responses: RequirementResponseRow[],
): Record<ResponseFilterKey, number> {
  const byReq = responsesByRequirement(responses);
  const counts = {
    ALL: 0,
    TODO: 0,
    INPUT_REQUIRED: 0,
    REVIEW: 0,
    APPROVED: 0,
    MANDATORY: 0,
    SCORED: 0,
  } satisfies Record<ResponseFilterKey, number>;
  for (const req of requirements) {
    const resp = byReq.get(req.id);
    for (const { key } of RESPONSE_FILTERS) {
      if (matchesResponseFilter(key, req, resp)) counts[key] += 1;
    }
  }
  return counts;
}

// -------------------------------------------------------------------- progress

/** Approval share, not draft share: a draft nobody signed off on is not progress. */
export function responseCompletionPercent(progress: ResponseProgress): number {
  if (progress.totalRequirements === 0) return 0;
  return Math.round((progress.approved / progress.totalRequirements) * 100);
}

export function responseProgressWithPercent(
  requirements: RequirementMatrixRow[],
  responses: RequirementResponseRow[],
): ResponseProgress & { completionPercent: number } {
  const progress = computeResponseProgress(requirements, responses);
  return { ...progress, completionPercent: responseCompletionPercent(progress) };
}

// ------------------------------------------------------------------ draft gate

export type DraftGateCode =
  | "ALLOWED"
  | "NO_REQUIREMENT"
  | "BLOCKED_SOURCE_SELECTED"
  | "APPROVED_LOCKED"
  | "LP_INPUT_REQUIRED"
  | "LP_INPUT_ACKNOWLEDGED"
  | "SOURCE_SELECTION_REQUIRED";

export type DraftGate = { allowed: boolean; code: DraftGateCode; message: string };

export const DRAFT_GATE_MESSAGES: Record<DraftGateCode, string> = {
  ALLOWED: "Generation runs against allowed evidence only. Output is a draft, never an approval.",
  NO_REQUIREMENT: "Select a requirement first.",
  BLOCKED_SOURCE_SELECTED:
    "A selected passage is DO_NOT_USE or SUPERSEDED. Blocked reuse can never enter proposal drafting.",
  APPROVED_LOCKED:
    "This response is human-approved. Reopen it for editing before regenerating — generation would replace approved text with an unapproved draft.",
  LP_INPUT_REQUIRED:
    "Evidence state is L&P INPUT REQUIRED: no allowed passage supports this requirement. Generation is disabled because a confident response here would be invented. Request L&P input instead.",
  LP_INPUT_ACKNOWLEDGED:
    "Overridden on an L&P INPUT REQUIRED requirement. Anything unsupported stays L&P INPUT REQUIRED — never invent pricing, staffing, metrics, references, or certifications.",
  SOURCE_SELECTION_REQUIRED:
    "Evidence state is REVIEW_REQUIRED: no passage is pre-approved for reuse. Select the passages a human has read before generating.",
};

/**
 * Blocked sources are rejected before any acknowledgement is considered, so no operator override
 * can route DO_NOT_USE into drafting.
 */
export function evaluateDraftGate(input: {
  requirementId: string | null;
  evidenceState: EvidenceState | null;
  draftStatus: DraftStatus | null;
  availableSources: { chunk_id: string; reuse_status: string }[];
  selectedSourceIds: string[];
  acknowledgeLpInput?: boolean;
}): DraftGate {
  const gate = (code: DraftGateCode, allowed: boolean): DraftGate => ({
    allowed,
    code,
    message: DRAFT_GATE_MESSAGES[code],
  });

  if (!input.requirementId) return gate("NO_REQUIREMENT", false);

  const byId = new Map(input.availableSources.map((s) => [s.chunk_id, s]));
  for (const id of input.selectedSourceIds) {
    const source = byId.get(id);
    if (!source || !isDraftingAllowedSource(source.reuse_status)) {
      return gate("BLOCKED_SOURCE_SELECTED", false);
    }
  }

  if (input.draftStatus === "APPROVED") return gate("APPROVED_LOCKED", false);

  if (input.evidenceState === "L_AND_P_INPUT_REQUIRED") {
    return input.acknowledgeLpInput
      ? gate("LP_INPUT_ACKNOWLEDGED", true)
      : gate("LP_INPUT_REQUIRED", false);
  }

  if (input.evidenceState === "REVIEW_REQUIRED" && input.selectedSourceIds.length === 0) {
    return gate("SOURCE_SELECTION_REQUIRED", false);
  }

  return gate("ALLOWED", true);
}

export function selectableDraftingSources<T extends { reuse_status: string }>(sources: T[]): T[] {
  return sources.filter((s) => isDraftingAllowedSource(s.reuse_status));
}

// ------------------------------------------------------------- save payloads

export type ResponseSaveIntent =
  | "AUTOSAVE"
  | "SAVE_DRAFT"
  | "APPROVE"
  | "REOPEN"
  | "REQUEST_LP_INPUT";

export const LP_INPUT_REQUEST_NOTE =
  "L&P INPUT REQUIRED — an operator flagged this requirement as unanswerable from verified evidence.";

type ExistingResponse = Pick<
  RequirementResponseRow,
  "evidence_state" | "assumptions" | "missing_information" | "confidence"
> | null;

/**
 * Builds the `saveRequirementResponse` form fields for one operator intent.
 *
 * `approve` is emitted for the APPROVE intent and nothing else, so autosave, manual save, reopen,
 * and L&P-input requests can never promote a draft to approved.
 */
export function buildResponseSavePayload(input: {
  intent: ResponseSaveIntent;
  requirementId: string;
  draftHtml: string;
  existing?: ExistingResponse;
  lpInputNote?: string;
}): Record<string, string> {
  const existing = input.existing ?? null;
  const payload: Record<string, string> = {
    requirement_id: input.requirementId,
    draft_html: input.draftHtml,
    evidence_state: existing?.evidence_state ?? "L_AND_P_INPUT_REQUIRED",
    assumptions: existing?.assumptions ?? "",
    missing_information: existing?.missing_information ?? "",
    confidence: existing?.confidence ?? "",
  };

  if (input.intent === "APPROVE") {
    payload.evidence_state = existing?.evidence_state ?? "REVIEW_REQUIRED";
    payload.approve = "1";
    return payload;
  }

  if (input.intent === "REQUEST_LP_INPUT") {
    payload.evidence_state = "L_AND_P_INPUT_REQUIRED";
    payload.confidence = "none";
    payload.missing_information = (input.lpInputNote ?? "").trim() || LP_INPUT_REQUEST_NOTE;
    return payload;
  }

  return payload;
}
