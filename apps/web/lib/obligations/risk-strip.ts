/**
 * F15 — Factual obligation risk strip (counts only — no opaque AI risk score).
 */

import { deriveObligationStatus, activeDueOn } from "./status";
import {
  isTerminalObligationStatus,
  type ContractObligation,
  type ObligationStatus,
} from "./types";

export type ObligationRiskCounts = {
  overdue: number;
  due: number;
  upcoming: number;
  /** Total HUMAN_VERIFIED open obligations considered. */
  verifiedOpen: number;
  /** AI_EXTRACTED / unverified excluded from risk counts. */
  unverifiedExcluded: number;
};

export const RISK_STRIP_NOTE =
  "Counts are factual overdue / due / upcoming among HUMAN_VERIFIED obligations only. No opaque AI risk score.";

/**
 * Count verified open obligations by derived status.
 * Only HUMAN_VERIFIED rows contribute to overdue/due/upcoming.
 */
export function countVerifiedObligationRisk(
  rows: ReadonlyArray<
    Pick<
      ContractObligation,
      | "verification_status"
      | "status"
      | "effective_on"
      | "due_on"
      | "next_due_on"
    >
  >,
  today: string,
): ObligationRiskCounts {
  let overdue = 0;
  let due = 0;
  let upcoming = 0;
  let verifiedOpen = 0;
  let unverifiedExcluded = 0;

  for (const row of rows) {
    if (row.verification_status !== "HUMAN_VERIFIED") {
      unverifiedExcluded += 1;
      continue;
    }
    if (isTerminalObligationStatus(row.status)) {
      continue;
    }
    verifiedOpen += 1;
    const status: ObligationStatus = deriveObligationStatus({
      status: row.status,
      effectiveOn: row.effective_on,
      dueOn: row.due_on,
      nextDueOn: row.next_due_on,
      today,
    });
    if (status === "OVERDUE") overdue += 1;
    else if (status === "DUE") due += 1;
    else if (status === "UPCOMING") upcoming += 1;
    // NOT_STARTED ignored in strip counts
  }

  return { overdue, due, upcoming, verifiedOpen, unverifiedExcluded };
}

export function sortObligationsByUrgency<
  T extends Pick<ContractObligation, "status" | "next_due_on" | "due_on" | "title">,
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aTerm = isTerminalObligationStatus(a.status);
    const bTerm = isTerminalObligationStatus(b.status);
    if (aTerm !== bTerm) return aTerm ? 1 : -1;
    const aDue = activeDueOn(a) ?? "9999-12-31";
    const bDue = activeDueOn(b) ?? "9999-12-31";
    if (aDue !== bDue) return aDue < bDue ? -1 : 1;
    return (a.title ?? "").localeCompare(b.title ?? "");
  });
}

export function formatRiskStripLabel(counts: ObligationRiskCounts): string {
  return `Overdue ${counts.overdue} · Due ${counts.due} · Upcoming ${counts.upcoming}`;
}
