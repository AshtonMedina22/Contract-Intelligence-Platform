/**
 * Thin research brief synthesis — cites AI_EXTRACTED vs HUMAN_VERIFIED separately.
 * Discloses unverified. No second chatbot; no LangGraph.
 */

import type { FactVerificationStatus } from "@/lib/supabase/database.types";

export type ResearchBriefFact = {
  id: string;
  title: string | null;
  claim: string | null;
  excerpt: string | null;
  source_url: string;
  verification_status: FactVerificationStatus;
  provider?: string | null;
};

export type ResearchBrief = {
  runId: string;
  summary: string;
  verifiedClaims: Array<{ claim: string; source_url: string; fact_id: string }>;
  unverifiedClaims: Array<{ claim: string; source_url: string; fact_id: string; status: FactVerificationStatus }>;
  rejectedCount: number;
  disclosure: string;
  insufficient: boolean;
};

export const RESEARCH_BRIEF_DISCLOSURE =
  "Public research is not L&P truth until a human verifies each fact. AI_EXTRACTED / NEEDS_REVIEW / CONFLICT rows are cite-only observations. Ask live public search is a separate cite-only rail; only HUMAN_VERIFIED research_facts are durable for reports.";

function claimText(f: ResearchBriefFact): string {
  return (f.claim ?? f.title ?? f.excerpt ?? f.source_url).trim();
}

/**
 * Build a brief from facts already loaded for a run. Pure — no LLM, no auto-verify.
 */
export function generateResearchBrief(runId: string, facts: ResearchBriefFact[]): ResearchBrief {
  const verifiedClaims = facts
    .filter((f) => f.verification_status === "HUMAN_VERIFIED")
    .map((f) => ({ claim: claimText(f), source_url: f.source_url, fact_id: f.id }));

  const unverifiedClaims = facts
    .filter(
      (f) =>
        f.verification_status === "AI_EXTRACTED" ||
        f.verification_status === "NEEDS_REVIEW" ||
        f.verification_status === "CONFLICT",
    )
    .map((f) => ({
      claim: claimText(f),
      source_url: f.source_url,
      fact_id: f.id,
      status: f.verification_status,
    }));

  const rejectedCount = facts.filter((f) => f.verification_status === "REJECTED").length;

  const insufficient = verifiedClaims.length === 0 && unverifiedClaims.length === 0;

  const summaryParts: string[] = [];
  if (verifiedClaims.length > 0) {
    summaryParts.push(`${verifiedClaims.length} HUMAN_VERIFIED claim(s).`);
  }
  if (unverifiedClaims.length > 0) {
    summaryParts.push(
      `${unverifiedClaims.length} unverified observation(s) (AI_EXTRACTED / NEEDS_REVIEW / CONFLICT) — disclose, do not treat as L&P truth.`,
    );
  }
  if (rejectedCount > 0) {
    summaryParts.push(`${rejectedCount} REJECTED.`);
  }
  if (insufficient) {
    summaryParts.push("No research facts on this run.");
  }

  return {
    runId,
    summary: summaryParts.join(" "),
    verifiedClaims,
    unverifiedClaims,
    rejectedCount,
    disclosure: RESEARCH_BRIEF_DISCLOSURE,
    insufficient,
  };
}
