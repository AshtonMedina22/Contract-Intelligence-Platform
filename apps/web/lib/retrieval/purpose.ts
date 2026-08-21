export type RetrievalPurpose =
  | "GENERAL_QA"
  | "LOCATE"
  | "LOSS_ANALYSIS"
  | "COMPETITOR_ANALYSIS"
  | "PRICING_ANALYSIS"
  | "BID_STRATEGY"
  | "PROPOSAL_DRAFTING"
  | "COMPLIANCE_REVIEW"
  | "REPORT_GENERATION"
  | "DEMO_TEST";

export type AskMode = "locate" | "ask" | "report";

export const RETRIEVAL_PURPOSES: RetrievalPurpose[] = [
  "GENERAL_QA",
  "LOCATE",
  "LOSS_ANALYSIS",
  "COMPETITOR_ANALYSIS",
  "PRICING_ANALYSIS",
  "BID_STRATEGY",
  "PROPOSAL_DRAFTING",
  "COMPLIANCE_REVIEW",
  "REPORT_GENERATION",
  "DEMO_TEST",
];

/** DO_NOT_USE may support retrospective analysis; never proposal drafting. */
export function purposeAllowsDoNotUse(purpose: RetrievalPurpose): boolean {
  return (
    purpose === "LOSS_ANALYSIS" ||
    purpose === "COMPETITOR_ANALYSIS" ||
    purpose === "LOCATE" ||
    purpose === "DEMO_TEST"
  );
}

export function purposeRequiresDraftingGates(purpose: RetrievalPurpose): boolean {
  return purpose === "PROPOSAL_DRAFTING" || !purposeAllowsDoNotUse(purpose);
}

export function defaultPurposeForMode(mode: AskMode): RetrievalPurpose {
  if (mode === "locate") return "LOCATE";
  if (mode === "report") return "REPORT_GENERATION";
  return "GENERAL_QA";
}

export function purposeFromParam(raw: string | undefined | null): RetrievalPurpose | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase() as RetrievalPurpose;
  return RETRIEVAL_PURPOSES.includes(upper) ? upper : null;
}
