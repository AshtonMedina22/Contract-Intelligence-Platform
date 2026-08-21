/**
 * F11 impact summary — honest counts from change items / runs only.
 * Never invents precision percentages.
 */

import type { SolicitationChangeType } from "./change-types";
import type { DetectChangesSummary } from "./detect-changes";

export type ChangeItemLike = {
  change_type: string;
  verification_status: string;
  ambiguity_reason?: string | null;
  applied_at?: string | null;
  impact_flags?: {
    responses?: boolean;
    pricing?: boolean;
    deadlines?: boolean;
    checklist?: boolean;
    readiness?: boolean;
  } | null;
};

export type ImpactSummary = {
  runs: number;
  items: number;
  unreviewed: number;
  verified_unapplied: number;
  applied: number;
  ambiguous: number;
  rejected: number;
  by_type: Partial<Record<SolicitationChangeType, number>>;
  impacts: {
    responses: number;
    pricing: number;
    deadlines: number;
    checklist: number;
    readiness: number;
  };
  headline: string;
  note: string;
};

export function buildImpactSummary(items: ChangeItemLike[], runCount = 1): ImpactSummary {
  const by_type: Partial<Record<SolicitationChangeType, number>> = {};
  const impacts = { responses: 0, pricing: 0, deadlines: 0, checklist: 0, readiness: 0 };
  let unreviewed = 0;
  let verified_unapplied = 0;
  let applied = 0;
  let ambiguous = 0;
  let rejected = 0;

  for (const item of items) {
    const t = item.change_type as SolicitationChangeType;
    by_type[t] = (by_type[t] ?? 0) + 1;
    if (item.ambiguity_reason || item.verification_status === "CONFLICT") ambiguous += 1;
    if (item.verification_status === "REJECTED") rejected += 1;
    if (
      item.verification_status === "AI_EXTRACTED" ||
      item.verification_status === "NEEDS_REVIEW"
    ) {
      unreviewed += 1;
    }
    if (item.verification_status === "HUMAN_VERIFIED" && !item.applied_at) {
      verified_unapplied += 1;
    }
    if (item.applied_at) applied += 1;

    const flags = item.impact_flags ?? {};
    if (flags.responses) impacts.responses += 1;
    if (flags.pricing) impacts.pricing += 1;
    if (flags.deadlines) impacts.deadlines += 1;
    if (flags.checklist) impacts.checklist += 1;
    if (flags.readiness) impacts.readiness += 1;
  }

  const headline =
    items.length === 0
      ? "No solicitation change items on this pursuit."
      : unreviewed > 0
        ? `${unreviewed} unreviewed change item(s) — AI draft only until verify.promote.`
        : verified_unapplied > 0
          ? `${verified_unapplied} verified item(s) ready to apply (human gate).`
          : applied > 0
            ? `${applied} change item(s) applied — check stale response/pricing flags.`
            : `${items.length} change item(s) recorded.`;

  return {
    runs: runCount,
    items: items.length,
    unreviewed,
    verified_unapplied,
    applied,
    ambiguous,
    rejected,
    by_type,
    impacts,
    headline,
    note: "Counts are from stored change items only. Material truth applies only after human verify + apply.",
  };
}

export function mergeDetectorSummary(
  summary: DetectChangesSummary,
  extras?: Partial<ImpactSummary>,
): ImpactSummary {
  return {
    runs: extras?.runs ?? 1,
    items:
      summary.added +
      summary.removed +
      summary.changed +
      summary.ambiguous,
    unreviewed: summary.unreviewed,
    verified_unapplied: 0,
    applied: 0,
    ambiguous: summary.ambiguous,
    rejected: 0,
    by_type: summary.by_type,
    impacts: extras?.impacts ?? {
      responses: 0,
      pricing: 0,
      deadlines: 0,
      checklist: 0,
      readiness: 0,
    },
    headline: `${summary.added} added · ${summary.changed} changed · ${summary.removed} removed · ${summary.ambiguous} ambiguous (unreviewed=${summary.unreviewed})`,
    note: summary.note,
  };
}

/** Submission-readiness advisory: pending addendum acknowledgement or stale flags. */
export function readinessAddendumAdvisory(input: {
  unreviewedChangeItems: number;
  addendumAcknowledgementCompleted: boolean | null;
  staleResponseCount: number;
  stalePricingCount: number;
}): { status: "CLEAR" | "ADVISORY" | "BLOCKING_HINT"; detail: string } {
  const parts: string[] = [];
  if (input.unreviewedChangeItems > 0) {
    parts.push(`${input.unreviewedChangeItems} unreviewed solicitation change(s)`);
  }
  if (input.addendumAcknowledgementCompleted === false) {
    parts.push("addendum acknowledgements not marked complete");
  }
  if (input.staleResponseCount > 0) {
    parts.push(`${input.staleResponseCount} response(s) flagged stale (text preserved)`);
  }
  if (input.stalePricingCount > 0) {
    parts.push(`${input.stalePricingCount} pricing decision(s) flagged stale (HUMAN_APPROVED preserved)`);
  }
  if (parts.length === 0) {
    return { status: "CLEAR", detail: "No pending addendum/Q&A impact flags." };
  }
  return {
    status: "ADVISORY",
    detail: parts.join("; ") + ". Apply verified changes and re-acknowledge before treating readiness as final.",
  };
}
