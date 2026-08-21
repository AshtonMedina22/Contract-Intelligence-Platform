/**
 * P8 — Submission readiness, submission authorization, and contract handoff model.
 *
 * Pure functions only: no Supabase, no React. The Submission workbench, the Result panel,
 * the server actions and `scripts/p8-submission-result-acceptance.mjs` all run this code.
 *
 * These helpers decide what an operator may *see* and *do*. They never submit, never sign,
 * never approve, and never soften a Phase 8 trust rule. `markSubmissionSubmitted` and
 * `createContractFromWin` remain the enforcing boundary.
 */

import type { ApprovalLayerKey, ApprovalStatus, ResponseProgress } from "./response";
import { APPROVAL_LAYER_OPTIONS } from "./response";

// --------------------------------------------------------------------- statuses

export type ReadinessStatus =
  | "COMPLETE"
  | "MISSING"
  | "NEEDS_SIGNATURE"
  | "NEEDS_APPROVAL"
  | "NOT_APPLICABLE"
  | "UNKNOWN";

export const READINESS_STATUS_ORDER: ReadinessStatus[] = [
  "COMPLETE",
  "MISSING",
  "NEEDS_SIGNATURE",
  "NEEDS_APPROVAL",
  "NOT_APPLICABLE",
  "UNKNOWN",
];

export const READINESS_STATUS_LABELS: Record<ReadinessStatus, string> = {
  COMPLETE: "Complete",
  MISSING: "Missing",
  NEEDS_SIGNATURE: "Needs signature",
  NEEDS_APPROVAL: "Needs approval",
  NOT_APPLICABLE: "Not applicable",
  UNKNOWN: "Unknown",
};

/**
 * Only COMPLETE and NOT_APPLICABLE are settled. Everything else — including UNKNOWN — is
 * outstanding, so an incomplete packet can never read as ready.
 */
export function isSettledStatus(status: ReadinessStatus): boolean {
  return status === "COMPLETE" || status === "NOT_APPLICABLE";
}

export type ReadinessGroup =
  | "CHECKLIST"
  | "APPROVALS"
  | "PRICING"
  | "RESPONSE"
  | "LOGISTICS";

export const READINESS_GROUP_LABELS: Record<ReadinessGroup, string> = {
  CHECKLIST: "Submission checklist",
  APPROVALS: "Internal approvals",
  PRICING: "Pricing decision",
  RESPONSE: "Response content",
  LOGISTICS: "Submission logistics",
};

export type ReadinessItem = {
  key: string;
  label: string;
  group: ReadinessGroup;
  /** Required items hard-block Mark submitted. Advisory items only inform. */
  required: boolean;
  status: ReadinessStatus;
  /** One honest sentence. Never a guess about something the record does not say. */
  detail: string;
  /** Pursuit tab that owns the fix, when the fix is not on the Submission tab. */
  fixOn: "response" | "pricing" | "requirements" | "submission" | null;
};

export type SubmissionOverall =
  | "NO_CHECKLIST"
  | "NOT_READY"
  | "READY_WITH_UNKNOWNS"
  | "READY"
  | "SUBMITTED";

export const SUBMISSION_OVERALL_LABELS: Record<SubmissionOverall, string> = {
  NO_CHECKLIST: "Readiness unknown — no checklist",
  NOT_READY: "Not ready to submit",
  READY_WITH_UNKNOWNS: "Required items complete — unknowns remain",
  READY: "Required items complete",
  SUBMITTED: "Marked submitted by a human",
};

export type SubmissionReadiness = {
  items: ReadinessItem[];
  counts: Record<ReadinessStatus, number>;
  /** Required items only, NOT_APPLICABLE excluded from the denominator. */
  requiredTotal: number;
  requiredComplete: number;
  requiredCompletionPercent: number;
  /** Required items that are not settled. These are the hard gate. */
  blocking: ReadinessItem[];
  /** Advisory items that are not settled. Shown, never gated on. */
  advisoryOutstanding: ReadinessItem[];
  unknown: ReadinessItem[];
  overall: SubmissionOverall;
  submittedAt: string | null;
  submittedBy: string | null;
  confirmationReference: string | null;
  /** Enabled layers that have not reached `approved`. */
  approvalsOutstanding: ApprovalLayerKey[];
  /** Layers switched off for this pursuit — config, not a gap. */
  approvalsDisabled: ApprovalLayerKey[];
};

// ------------------------------------------------------------------ input shapes

export type ReadinessChecklistInput = {
  id?: string;
  item_key: string;
  label: string;
  required: boolean;
  completed: boolean;
  notes?: string | null;
};

export type ReadinessApprovalInput = {
  layer_key: ApprovalLayerKey;
  enabled: boolean;
  status: ApprovalStatus;
  decided_at?: string | null;
  notes?: string | null;
};

export type ReadinessPricingInput = {
  status: string | null;
  final_bid_rate: number | null;
  final_bid_amount: number | null;
  decided_by?: string | null;
  decided_at?: string | null;
};

export type ReadinessPacketInput = {
  due_at?: string | null;
  question_deadline_at?: string | null;
  submission_method?: string | null;
  submission_url?: string | null;
  portal_recipient?: string | null;
  submission_instructions?: string | null;
  final_output_version?: string | null;
  submitted_at?: string | null;
  submitted_by?: string | null;
  confirmation_reference?: string | null;
};

export type SubmissionReadinessInput = {
  checklist: ReadinessChecklistInput[];
  approvals: ReadinessApprovalInput[];
  /** `null` means "no decision recorded". `undefined` means "not loaded" — both stay UNKNOWN. */
  pricingDecision?: ReadinessPricingInput | null;
  responseProgress?: ResponseProgress | null;
  packet?: ReadinessPacketInput | null;
};

// -------------------------------------------------------------- classification

const SIGNATURE_KEY_RE = /sign|notar|seal|attest/i;
const APPROVAL_KEY_RE = /approval/i;

export function checklistItemKind(
  item: Pick<ReadinessChecklistInput, "item_key" | "label">,
): "SIGNATURE" | "APPROVAL" | "DOCUMENT" {
  const blob = `${item.item_key} ${item.label}`;
  if (APPROVAL_KEY_RE.test(blob)) return "APPROVAL";
  if (SIGNATURE_KEY_RE.test(blob)) return "SIGNATURE";
  return "DOCUMENT";
}

function approvalLayerLabel(key: ApprovalLayerKey): string {
  return APPROVAL_LAYER_OPTIONS.find((o) => o.value === key)?.label ?? key;
}

function checklistItem(
  item: ReadinessChecklistInput,
  enabledApprovals: ReadinessApprovalInput[],
): ReadinessItem {
  const kind = checklistItemKind(item);
  const base = {
    key: `checklist:${item.item_key}`,
    label: item.label,
    group: "CHECKLIST" as const,
    required: item.required,
    fixOn: null,
  };

  if (kind === "APPROVAL") {
    // A recorded approval layer outranks the manual tick: an operator cannot mark
    // "Internal approvals" complete while an enabled layer is still outstanding.
    if (enabledApprovals.length > 0) {
      const outstanding = enabledApprovals.filter((a) => a.status !== "approved");
      return outstanding.length === 0
        ? {
            ...base,
            status: "COMPLETE",
            detail: `All ${enabledApprovals.length} enabled approval layer(s) are approved.`,
            fixOn: "response",
          }
        : {
            ...base,
            status: "NEEDS_APPROVAL",
            detail: `${outstanding.length} enabled approval layer(s) not approved: ${outstanding
              .map((a) => `${approvalLayerLabel(a.layer_key)} (${a.status})`)
              .join(", ")}.`,
            fixOn: "response",
          };
    }
    return item.completed
      ? {
          ...base,
          status: "COMPLETE",
          detail:
            "Ticked by an operator. No approval layer is enabled on this pursuit, so this is an attestation, not a recorded approval.",
          fixOn: "response",
        }
      : {
          ...base,
          status: "NEEDS_APPROVAL",
          detail: "Not ticked, and no approval layer is enabled to prove an approval happened.",
          fixOn: "response",
        };
  }

  if (item.completed) {
    return {
      ...base,
      status: "COMPLETE",
      detail: item.notes?.trim() ? `Marked complete. ${item.notes.trim()}` : "Marked complete by an operator.",
    };
  }

  if (kind === "SIGNATURE") {
    return {
      ...base,
      status: "NEEDS_SIGNATURE",
      detail:
        "Signature / notarization outstanding. The platform does not sign anything — a human signs and then marks this item.",
    };
  }

  return {
    ...base,
    status: "MISSING",
    detail: item.required
      ? "Required for submission and not marked complete."
      : "Optional and not marked complete.",
  };
}

function approvalItems(approvals: ReadinessApprovalInput[]): ReadinessItem[] {
  return approvals
    .filter((a) => a.enabled)
    .map((a) => {
      const label = `${approvalLayerLabel(a.layer_key)} approval`;
      const base = {
        key: `approval:${a.layer_key}`,
        label,
        group: "APPROVALS" as const,
        required: true,
        fixOn: "response" as const,
      };
      if (a.status === "approved") {
        return {
          ...base,
          status: "COMPLETE" as const,
          detail: a.decided_at
            ? `Approved by a human on ${a.decided_at}.`
            : "Approved by a human.",
        };
      }
      const detail =
        a.status === "requested"
          ? "Requested and still awaiting a human decision."
          : a.status === "changes_requested"
            ? `Changes requested${a.notes?.trim() ? `: ${a.notes.trim()}` : "."}`
            : `Rejected${a.notes?.trim() ? `: ${a.notes.trim()}` : "."}`;
      return { ...base, status: "NEEDS_APPROVAL" as const, detail };
    });
}

function pricingItem(pricing: ReadinessPricingInput | null | undefined): ReadinessItem {
  const base = {
    key: "pricing:decision",
    label: "Human final bid decision",
    group: "PRICING" as const,
    required: false,
    fixOn: "pricing" as const,
  };
  if (pricing === undefined) {
    return {
      ...base,
      status: "UNKNOWN",
      detail: "Pricing decision was not loaded, so nothing is claimed about the final bid.",
    };
  }
  if (pricing === null) {
    return {
      ...base,
      status: "UNKNOWN",
      detail: "No pricing decision recorded. The final bid is always a human decision on Pricing.",
    };
  }
  const hasAmount = pricing.final_bid_rate != null || pricing.final_bid_amount != null;
  if (pricing.status !== "HUMAN_APPROVED") {
    return {
      ...base,
      status: "MISSING",
      detail: `Latest pricing decision is ${pricing.status ?? "unset"} — no human final bid has been approved.`,
    };
  }
  if (!hasAmount) {
    return {
      ...base,
      status: "UNKNOWN",
      detail: "Pricing decision is HUMAN_APPROVED but carries no rate or amount.",
    };
  }
  return {
    ...base,
    status: "COMPLETE",
    detail: "A human approved a final bid rate or amount on Pricing.",
  };
}

function responseItem(progress: ResponseProgress | null | undefined): ReadinessItem {
  const base = {
    key: "response:progress",
    label: "Requirement responses",
    group: "RESPONSE" as const,
    required: false,
    fixOn: "response" as const,
  };
  if (!progress) {
    return {
      ...base,
      status: "UNKNOWN",
      detail: "Response progress was not loaded, so nothing is claimed about draft coverage.",
    };
  }
  if (progress.totalRequirements === 0) {
    return {
      ...base,
      status: "UNKNOWN",
      detail: "No requirements are promoted for this pursuit, so response coverage cannot be measured.",
      fixOn: "requirements",
    };
  }
  if (progress.mandatoryOutstanding > 0) {
    return {
      ...base,
      status: "MISSING",
      detail: `${progress.mandatoryOutstanding} mandatory requirement(s) have no draft, and ${progress.lpInputRequired} are L&P INPUT REQUIRED.`,
    };
  }
  if (progress.lpInputRequired > 0) {
    return {
      ...base,
      status: "MISSING",
      detail: `${progress.lpInputRequired} requirement(s) are L&P INPUT REQUIRED — unsupported facts must not be invented to close them.`,
    };
  }
  if (progress.approved < progress.totalRequirements) {
    return {
      ...base,
      status: "NEEDS_APPROVAL",
      detail: `${progress.approved} of ${progress.totalRequirements} requirement responses are human-approved.`,
    };
  }
  return {
    ...base,
    status: "COMPLETE",
    detail: `All ${progress.totalRequirements} requirement responses are human-approved.`,
  };
}

function logisticsItems(packet: ReadinessPacketInput | null | undefined): ReadinessItem[] {
  const items: ReadinessItem[] = [];
  const method = packet?.submission_method?.trim() ?? "";
  items.push({
    key: "logistics:method",
    label: "Submission method",
    group: "LOGISTICS",
    required: false,
    status: method ? "COMPLETE" : "UNKNOWN",
    detail: method
      ? `Recorded as ${method}.`
      : "No submission method recorded (portal, email, or physical delivery).",
    fixOn: null,
  });
  items.push({
    key: "logistics:due",
    label: "Submission deadline",
    group: "LOGISTICS",
    required: false,
    status: packet?.due_at ? "COMPLETE" : "UNKNOWN",
    detail: packet?.due_at
      ? `Due ${packet.due_at}.`
      : "No submission deadline recorded on the packet.",
    fixOn: null,
  });
  if (packet?.submitted_at) {
    items.push({
      key: "logistics:confirmation",
      label: "Buyer confirmation / reference",
      group: "LOGISTICS",
      required: false,
      status: packet.confirmation_reference?.trim() ? "COMPLETE" : "MISSING",
      detail: packet.confirmation_reference?.trim()
        ? `Confirmation ${packet.confirmation_reference.trim()}.`
        : "Submitted, but no portal confirmation or reference number is captured yet.",
      fixOn: null,
    });
  }
  return items;
}

// ------------------------------------------------------------------- the model

export function computeSubmissionReadiness(
  input: SubmissionReadinessInput,
): SubmissionReadiness {
  const approvals = input.approvals ?? [];
  const enabledApprovals = approvals.filter((a) => a.enabled);
  const packet = input.packet ?? null;

  const items: ReadinessItem[] = [];

  if ((input.checklist ?? []).length === 0) {
    // No checklist means no evidence of readiness. It must never read as ready.
    items.push({
      key: "checklist:none",
      label: "Submission checklist",
      group: "CHECKLIST",
      required: true,
      status: "UNKNOWN",
      detail:
        "No submission checklist exists on this pursuit. Seed the default checklist before claiming readiness.",
      fixOn: "submission",
    });
  } else {
    for (const item of input.checklist) items.push(checklistItem(item, enabledApprovals));
  }

  items.push(...approvalItems(approvals));
  items.push(pricingItem(input.pricingDecision));
  items.push(responseItem(input.responseProgress));
  items.push(...logisticsItems(packet));

  const counts = {
    COMPLETE: 0,
    MISSING: 0,
    NEEDS_SIGNATURE: 0,
    NEEDS_APPROVAL: 0,
    NOT_APPLICABLE: 0,
    UNKNOWN: 0,
  } satisfies Record<ReadinessStatus, number>;
  for (const item of items) counts[item.status] += 1;

  const requiredItems = items.filter((i) => i.required && i.status !== "NOT_APPLICABLE");
  const requiredComplete = requiredItems.filter((i) => i.status === "COMPLETE").length;
  const blocking = items.filter((i) => i.required && !isSettledStatus(i.status));
  const advisoryOutstanding = items.filter((i) => !i.required && !isSettledStatus(i.status));
  const unknown = items.filter((i) => i.status === "UNKNOWN");

  const submittedAt = packet?.submitted_at?.trim() || null;
  const overall: SubmissionOverall = submittedAt
    ? "SUBMITTED"
    : (input.checklist ?? []).length === 0
      ? "NO_CHECKLIST"
      : blocking.length > 0
        ? "NOT_READY"
        : unknown.length > 0
          ? "READY_WITH_UNKNOWNS"
          : "READY";

  return {
    items,
    counts,
    requiredTotal: requiredItems.length,
    requiredComplete,
    requiredCompletionPercent:
      requiredItems.length === 0 ? 0 : Math.round((requiredComplete / requiredItems.length) * 100),
    blocking,
    advisoryOutstanding,
    unknown,
    overall,
    submittedAt,
    submittedBy: packet?.submitted_by?.trim() || null,
    confirmationReference: packet?.confirmation_reference?.trim() || null,
    approvalsOutstanding: enabledApprovals.filter((a) => a.status !== "approved").map((a) => a.layer_key),
    approvalsDisabled: approvals.filter((a) => !a.enabled).map((a) => a.layer_key),
  };
}

// ------------------------------------------------------- submission authorization

export type MarkSubmittedGateCode =
  | "ALLOWED"
  | "ALREADY_SUBMITTED"
  | "NO_CHECKLIST"
  | "REQUIRED_ITEMS_INCOMPLETE"
  | "APPROVALS_OUTSTANDING"
  | "AUTHORIZATION_REQUIRED";

export type MarkSubmittedGate = {
  allowed: boolean;
  code: MarkSubmittedGateCode;
  message: string;
};

export const SUBMISSION_AUTHORIZATION_LABEL =
  "I submitted this response to the buyer myself and I am recording it now.";

export const NO_AUTO_SUBMIT_NOTICE =
  "Nothing here submits, signs, or approves on your behalf. Marking submitted only records what a human already did.";

/**
 * Hard gate. Required checklist items and enabled approval layers must be settled, and a
 * human must explicitly authorize the record, before a pursuit can be marked SUBMITTED.
 * Blocking reasons are evaluated before the authorization tick so a tick can never buy past them.
 */
export function evaluateMarkSubmittedGate(input: {
  readiness: SubmissionReadiness;
  humanAuthorized: boolean;
}): MarkSubmittedGate {
  const { readiness } = input;

  if (readiness.submittedAt) {
    return {
      allowed: false,
      code: "ALREADY_SUBMITTED",
      message: `Already marked submitted at ${readiness.submittedAt}. Capture the buyer confirmation instead of re-marking.`,
    };
  }

  if (readiness.overall === "NO_CHECKLIST") {
    return {
      allowed: false,
      code: "NO_CHECKLIST",
      message:
        "No submission checklist exists on this pursuit. Seed the checklist and work it before recording a submission.",
    };
  }

  // An approval blocker is reported as one wherever it came from, so the operator is sent to the
  // Response tab rather than told to tick a checklist row they cannot honestly tick.
  const isApprovalBlocker = (i: ReadinessItem) =>
    i.group === "APPROVALS" || i.status === "NEEDS_APPROVAL";
  const approvalBlockers = readiness.blocking.filter(isApprovalBlocker);
  const otherBlockers = readiness.blocking.filter((i) => !isApprovalBlocker(i));

  if (otherBlockers.length > 0) {
    // The approval count is named here too, so the banner total always matches the blocking list.
    const alsoApprovals = approvalBlockers.length
      ? ` Also outstanding: ${approvalBlockers.length} approval item(s), decided by a human on the Response tab.`
      : "";
    return {
      allowed: false,
      code: "REQUIRED_ITEMS_INCOMPLETE",
      message: `${otherBlockers.length} required item(s) are outstanding: ${otherBlockers
        .map((i) => `${i.label} — ${READINESS_STATUS_LABELS[i.status]}`)
        .join("; ")}.${alsoApprovals}`,
    };
  }

  if (approvalBlockers.length > 0) {
    return {
      allowed: false,
      code: "APPROVALS_OUTSTANDING",
      message: `${approvalBlockers.length} enabled approval layer(s) are not approved: ${approvalBlockers
        .map((i) => i.label)
        .join("; ")}. Approvals are decided by a human on the Response tab.`,
    };
  }

  if (!input.humanAuthorized) {
    return {
      allowed: false,
      code: "AUTHORIZATION_REQUIRED",
      message: `Human submission authorization required. Confirm: "${SUBMISSION_AUTHORIZATION_LABEL}"`,
    };
  }

  return {
    allowed: true,
    code: "ALLOWED",
    message: "A human may record this submission. Recording it does not submit anything.",
  };
}

// ----------------------------------------------------------------- output honesty

export type SubmissionOutputKind =
  | "HTML_PRINT"
  | "WORD_HTML"
  | "PLAIN_TEXT"
  | "GOOGLE_DOCS"
  | "PRICING_WORKBOOK"
  | "RESPONSE_TAB";

export type SubmissionOutput = {
  kind: SubmissionOutputKind;
  label: string;
  /** What the file or link actually is. No format is claimed that is not produced. */
  honestNote: string;
  /** True only when this pursuit can actually produce it right now. */
  available: boolean;
  unavailableReason: string | null;
};

/**
 * Describes the outputs the Submission tab can honestly produce. There is no DOCX/OOXML
 * writer and no Google Docs integration in this codebase, so neither is offered as one.
 */
export function describeSubmissionOutputs(input: {
  hasResponseContent: boolean;
  googleDocsUrl: string | null | undefined;
  googleDocsIntegration?: boolean;
}): SubmissionOutput[] {
  const noContent = "No response draft content exists yet — the export would be an empty file.";
  const hasContent = input.hasResponseContent;
  const docsUrl = input.googleDocsUrl?.trim() ?? "";

  return [
    {
      kind: "HTML_PRINT",
      label: "Download HTML (print to PDF)",
      honestNote:
        "A single HTML file of the saved requirement drafts. Use the browser print dialog to produce a PDF; the app does not render PDFs.",
      available: hasContent,
      unavailableReason: hasContent ? null : noContent,
    },
    {
      kind: "WORD_HTML",
      label: "Download Word-compatible HTML (.doc)",
      honestNote:
        "HTML in a .doc wrapper that Microsoft Word and Google Docs will open. This is not a native DOCX/OOXML file and no DOCX writer exists in this codebase.",
      available: hasContent,
      unavailableReason: hasContent ? null : noContent,
    },
    {
      kind: "PLAIN_TEXT",
      label: "Copy plain text",
      honestNote:
        "Tag-stripped text on the clipboard for pasting into a buyer portal field. Formatting is lost.",
      available: hasContent,
      unavailableReason: hasContent ? null : noContent,
    },
    {
      kind: "GOOGLE_DOCS",
      label: "Open Google Docs working copy",
      honestNote: input.googleDocsIntegration
        ? "Opens the linked Google Docs document."
        : "Opens a URL an operator pasted. There is no Google Docs integration: nothing is created, pushed, or synced.",
      available: Boolean(docsUrl),
      unavailableReason: docsUrl
        ? null
        : "No Google Docs URL recorded on this packet. Paste one in Submission details to link an existing document.",
    },
    {
      kind: "PRICING_WORKBOOK",
      label: "Pricing workbook",
      honestNote: "Opens the Pursuit → Pricing tab. Pricing is exported from there, not from here.",
      available: true,
      unavailableReason: null,
    },
    {
      kind: "RESPONSE_TAB",
      label: "Response drafts",
      honestNote: "Opens the Pursuit → Response tab where the drafts are authored and approved.",
      available: true,
      unavailableReason: null,
    },
  ];
}

// --------------------------------------------------------- outcome + contract gate

export const RESULT_FIELD_SCOPE = {
  DOCUMENTED:
    "Buyer-documented — sourced from the buyer's award record, tabulation, or debrief. Leave blank when the buyer never published it.",
  INTERNAL:
    "Internal only — L&P analysis. Never sent to a buyer and never treated as buyer-published fact.",
} as const;

export type ContractHandoffGateCode =
  | "ALLOWED"
  | "EXISTING_CONTRACT"
  | "OUTCOME_NOT_RECORDED"
  | "OUTCOME_NOT_WON"
  | "NO_PURSUIT_DOCUMENTS"
  | "NO_VERIFIED_AWARD_FACT"
  | "TITLE_REQUIRED";

export type ContractHandoffGate = {
  allowed: boolean;
  code: ContractHandoffGateCode;
  message: string;
};

/** Fields / entities that read as an award, contract, or ordering instrument. */
export const AWARDISH_FACT_RE =
  /award|contract|po\b|purchase.?order|nte|not.?to.?exceed|instrument|agreement|vehicle|txmas|mas/i;

export function isAwardishFact(fact: { field?: string | null; entity?: string | null }): boolean {
  return AWARDISH_FACT_RE.test(`${fact.field ?? ""} ${fact.entity ?? ""}`);
}

/**
 * The same decision `createContractFromWin` enforces, expressed once so the Result panel can
 * explain the block *before* the operator clicks, in the same words the action would throw.
 *
 * A contract row is a canonical portfolio claim. It requires a HUMAN_VERIFIED award-shaped
 * fact on this pursuit — a WON checkbox is not evidence.
 */
export function evaluateContractHandoffGate(input: {
  existingContractId?: string | null;
  outcome?: string | null;
  title?: string | null;
  pursuitDocumentCount: number;
  verifiedAwardishFactCount: number;
}): ContractHandoffGate {
  if (input.existingContractId) {
    return {
      allowed: false,
      code: "EXISTING_CONTRACT",
      message:
        "A contract is already linked to this pursuit. Open it — creating a second one would duplicate the portfolio row.",
    };
  }
  if (input.title !== undefined && !String(input.title ?? "").trim()) {
    return { allowed: false, code: "TITLE_REQUIRED", message: "Contract title required." };
  }
  if (input.pursuitDocumentCount === 0) {
    return {
      allowed: false,
      code: "NO_PURSUIT_DOCUMENTS",
      message:
        "Cannot create a contract without pursuit documents. Ingest the award notice, contract, or purchase order in Data Ops → Intake, verify a fact from it, then return here.",
    };
  }
  if (input.verifiedAwardishFactCount === 0) {
    return {
      allowed: false,
      code: "NO_VERIFIED_AWARD_FACT",
      message:
        "Cannot create a contract without a HUMAN_VERIFIED award-shaped fact on this pursuit. This pursuit has documents, but none of their verified facts name an award, contract, purchase order, NTE, agreement, or ordering vehicle. Verify one in Data Ops → Verification first — a WON outcome is not evidence of a contract.",
    };
  }
  if (input.outcome !== undefined) {
    const outcome = String(input.outcome ?? "").trim();
    if (!outcome) {
      return {
        allowed: false,
        code: "OUTCOME_NOT_RECORDED",
        // A verified award fact proves an award was published, not that L&P won it — the award
        // notice on a lost pursuit names the competitor. Only a human records the win.
        message:
          "No outcome is recorded for this pursuit. A verified award fact can name any bidder, including a competitor, so record the outcome as WON above before creating a contract.",
      };
    }
    if (outcome !== "WON") {
      return {
        allowed: false,
        code: "OUTCOME_NOT_WON",
        message: `Recorded outcome is ${outcome}. Record the outcome as WON before creating a contract from this pursuit.`,
      };
    }
  }
  return {
    allowed: true,
    code: "ALLOWED",
    message:
      "A HUMAN_VERIFIED award-shaped fact backs this handoff. The contract will cite that fact and its document.",
  };
}
