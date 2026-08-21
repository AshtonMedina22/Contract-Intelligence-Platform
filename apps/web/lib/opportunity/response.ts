/** Phase 8 — Response / Submission / Result domain types + helpers. */

export type EvidenceState =
  | "VERIFIED_DRAFT_AVAILABLE"
  | "REVIEW_REQUIRED"
  | "L_AND_P_INPUT_REQUIRED";

export type DraftStatus = "EMPTY" | "DRAFT" | "APPROVED";

export type RequirementMatrixStatus =
  | "OPEN"
  | "DRAFTING"
  | "DRAFTED"
  | "APPROVED"
  | "L_AND_P_INPUT_REQUIRED";

export type ApprovalLayerKey = "content" | "operations" | "pricing" | "compliance" | "executive";

export type ApprovalStatus = "requested" | "approved" | "changes_requested" | "rejected";

export type OpportunityResultOutcome =
  | "PENDING"
  | "WON"
  | "LOST"
  | "NO_BID"
  | "CANCELLED"
  | "NO_AWARD";

export const APPROVAL_LAYER_OPTIONS: { value: ApprovalLayerKey; label: string }[] = [
  { value: "content", label: "Content" },
  { value: "operations", label: "Operations" },
  { value: "pricing", label: "Pricing" },
  { value: "compliance", label: "Compliance" },
  { value: "executive", label: "Executive / final" },
];

export const RESULT_OUTCOME_OPTIONS: { value: OpportunityResultOutcome; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost / Not Selected" },
  { value: "NO_BID", label: "No Bid" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "NO_AWARD", label: "No Award / All Bids Rejected" },
];

export const DEFAULT_SUBMISSION_CHECKLIST: { item_key: string; label: string; sort_order: number }[] = [
  { item_key: "required_forms", label: "Required forms", sort_order: 10 },
  { item_key: "pricing_schedules", label: "Pricing schedules", sort_order: 20 },
  { item_key: "references", label: "References", sort_order: 30 },
  { item_key: "insurance", label: "Insurance", sort_order: 40 },
  { item_key: "certifications", label: "Certifications", sort_order: 50 },
  { item_key: "affidavits", label: "Affidavits", sort_order: 60 },
  { item_key: "signatures", label: "Signatures", sort_order: 70 },
  { item_key: "notarization", label: "Notarization", sort_order: 80 },
  { item_key: "addendum_acknowledgements", label: "Addendum acknowledgements", sort_order: 90 },
  { item_key: "attachments", label: "Attachments", sort_order: 100 },
  { item_key: "approvals", label: "Internal approvals", sort_order: 110 },
];

/** Facts GPT must never invent for L&P. */
export const NEVER_INVENT_LP_FACTS = [
  "pricing",
  "employees",
  "turnover",
  "staffing capacity",
  "response time",
  "performance metrics",
  "contracts",
  "references",
  "certifications",
  "capabilities",
  "margins",
] as const;

export type RequirementMatrixRow = {
  id: string;
  statement: string;
  solicitation_id: string;
  source_fact_id: string | null;
  mandatory: boolean;
  scored: boolean;
  weight_pct: number | null;
  section_ref: string | null;
  source_page: number | null;
  response_required: boolean;
  attachment_required: boolean;
  form_name: string | null;
  owner_name: string | null;
  verification_note: string | null;
  matrix_status: RequirementMatrixStatus;
};

export type RequirementResponseRow = {
  id: string;
  requirement_id: string;
  draft_html: string;
  evidence_state: EvidenceState;
  draft_status: DraftStatus;
  sources_used: unknown;
  assumptions: string | null;
  missing_information: string | null;
  confidence: string | null;
};

export type ResponseProgress = {
  totalRequirements: number;
  verified: number;
  drafted: number;
  approved: number;
  lpInputRequired: number;
  mandatoryOutstanding: number;
  requiredAttachmentsMissing: number;
};

export function computeResponseProgress(
  requirements: RequirementMatrixRow[],
  responses: RequirementResponseRow[],
): ResponseProgress {
  const byReq = new Map(responses.map((r) => [r.requirement_id, r]));
  let drafted = 0;
  let approved = 0;
  let lpInputRequired = 0;
  let mandatoryOutstanding = 0;
  let requiredAttachmentsMissing = 0;
  let verified = 0;

  for (const req of requirements) {
    if (req.source_fact_id) verified += 1;
    const resp = byReq.get(req.id);
    if (resp?.draft_status === "APPROVED" || req.matrix_status === "APPROVED") approved += 1;
    else if (
      resp?.draft_status === "DRAFT" ||
      req.matrix_status === "DRAFTED" ||
      req.matrix_status === "DRAFTING"
    ) {
      drafted += 1;
    }
    if (
      resp?.evidence_state === "L_AND_P_INPUT_REQUIRED" ||
      req.matrix_status === "L_AND_P_INPUT_REQUIRED"
    ) {
      lpInputRequired += 1;
    }
    if (req.mandatory && req.response_required) {
      const hasDraft =
        resp &&
        resp.draft_status !== "EMPTY" &&
        (resp.draft_html?.replace(/<[^>]+>/g, "").trim().length ?? 0) > 0;
      if (!hasDraft && req.matrix_status !== "APPROVED") mandatoryOutstanding += 1;
    }
    if (req.attachment_required && req.matrix_status !== "APPROVED") {
      requiredAttachmentsMissing += 1;
    }
  }

  return {
    totalRequirements: requirements.length,
    verified,
    drafted,
    approved,
    lpInputRequired,
    mandatoryOutstanding,
    requiredAttachmentsMissing,
  };
}

export type GroundedDraftResult = {
  draft_response: string;
  sources_used: { chunk_id: string; reuse_status: string; excerpt: string }[];
  assumptions: string;
  missing_information: string;
  confidence: string;
  evidence_state: EvidenceState;
};

/** Reuse statuses that may never reach PROPOSAL_DRAFTING, at retrieval or at assembly. */
export const BLOCKED_REUSE_STATUSES = ["DO_NOT_USE", "SUPERSEDED"] as const;

export function isDraftingAllowedSource(reuseStatus: string): boolean {
  return !(BLOCKED_REUSE_STATUSES as readonly string[]).includes(reuseStatus);
}

export type SourceUsed = { chunk_id: string; reuse_status: string; excerpt: string };

/** `requirement_responses.sources_used` is jsonb; read it defensively and drop blocked rows. */
export function parseSourcesUsed(value: unknown): SourceUsed[] {
  if (!Array.isArray(value)) return [];
  const parsed: SourceUsed[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const chunk_id = typeof row.chunk_id === "string" ? row.chunk_id : "";
    if (!chunk_id) continue;
    const reuse_status = typeof row.reuse_status === "string" ? row.reuse_status : "UNKNOWN";
    if (!isDraftingAllowedSource(reuse_status)) continue;
    parsed.push({
      chunk_id,
      reuse_status,
      excerpt: typeof row.excerpt === "string" ? row.excerpt : "",
    });
  }
  return parsed;
}

export function classifyEvidenceFromHits(
  hits: { reuse_status: string; content: string }[],
): EvidenceState {
  const usable = hits.filter((h) => isDraftingAllowedSource(h.reuse_status));
  if (usable.length === 0) return "L_AND_P_INPUT_REQUIRED";
  if (usable.some((h) => h.reuse_status === "APPROVED")) return "VERIFIED_DRAFT_AVAILABLE";
  return "REVIEW_REQUIRED";
}

export function buildGroundedDraftFromHits(opts: {
  requirementStatement: string;
  hits: { chunk_id: string; reuse_status: string; content: string }[];
  llmText?: string | null;
}): GroundedDraftResult {
  const evidence_state = classifyEvidenceFromHits(opts.hits);
  const allowed = opts.hits.filter((h) => isDraftingAllowedSource(h.reuse_status));
  const sources_used = allowed.slice(0, 8).map((h) => ({
    chunk_id: h.chunk_id,
    reuse_status: h.reuse_status,
    excerpt: h.content.slice(0, 240),
  }));

  if (evidence_state === "L_AND_P_INPUT_REQUIRED") {
    return {
      draft_response: "",
      sources_used: [],
      assumptions: "No allowed historical passages for PROPOSAL_DRAFTING.",
      missing_information: `L&P INPUT REQUIRED for: ${opts.requirementStatement.slice(0, 200)}`,
      confidence: "none",
      evidence_state,
    };
  }

  const draft =
    opts.llmText?.trim() ||
    [
      `<p><strong>Draft (evidence-backed — human review required)</strong></p>`,
      `<p>Requirement: ${escapeHtml(opts.requirementStatement)}</p>`,
      `<p>Reuse: ${allowed[0]?.reuse_status ?? "REVIEW_REQUIRED"}. Won ≠ automatically reusable; Lost ≠ automatically worthless.</p>`,
      ...allowed.slice(0, 3).map(
        (h, i) =>
          `<p>[${i + 1}] (${escapeHtml(h.reuse_status)}) ${escapeHtml(h.content.slice(0, 400))}</p>`,
      ),
      `<p><em>Unsupported L&amp;P facts must stay marked L&amp;P INPUT REQUIRED — never invent ${NEVER_INVENT_LP_FACTS.join(", ")}.</em></p>`,
    ].join("\n");

  return {
    draft_response: draft,
    sources_used,
    assumptions:
      evidence_state === "REVIEW_REQUIRED"
        ? "Historical content requires human review before reuse (REVIEW_REQUIRED)."
        : "Draft assembled only from APPROVED / REVIEW_REQUIRED verified passages under PROPOSAL_DRAFTING gates.",
    missing_information:
      evidence_state === "VERIFIED_DRAFT_AVAILABLE"
        ? ""
        : "Human must confirm REVIEW_REQUIRED passages before treating as final.",
    confidence: evidence_state === "VERIFIED_DRAFT_AVAILABLE" ? "medium" : "low",
    evidence_state,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
