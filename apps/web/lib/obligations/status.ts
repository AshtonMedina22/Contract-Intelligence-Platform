/**
 * F15 — Pure date → obligation status (no React / no Supabase).
 */

import {
  isTerminalObligationStatus,
  type ObligationStatus,
} from "./types";

export const DEFAULT_DUE_SOON_DAYS = 7;

export type DeriveObligationStatusInput = {
  /** Stored status — terminal values are preserved. */
  status?: ObligationStatus | string | null;
  effectiveOn?: string | null;
  dueOn?: string | null;
  nextDueOn?: string | null;
  /** ISO date YYYY-MM-DD */
  today: string;
  dueSoonDays?: number;
};

function parseIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return d;
}

/** Days from `today` to `due` (negative = overdue). */
export function daysUntilDue(dueIso: string, todayIso: string): number {
  const due = Date.parse(`${dueIso}T00:00:00Z`);
  const today = Date.parse(`${todayIso}T00:00:00Z`);
  return Math.round((due - today) / 86_400_000);
}

/**
 * Derive operational status from dates.
 * COMPLETED / WAIVED / SUPERSEDED are never overwritten by dates.
 */
export function deriveObligationStatus(input: DeriveObligationStatusInput): ObligationStatus {
  const stored = input.status ?? "NOT_STARTED";
  if (isTerminalObligationStatus(stored)) {
    return stored as ObligationStatus;
  }

  const today = parseIsoDate(input.today);
  if (!today) return "NOT_STARTED";

  const effective = parseIsoDate(input.effectiveOn ?? null);
  if (effective && today < effective) {
    return "NOT_STARTED";
  }

  const due = parseIsoDate(input.nextDueOn ?? null) ?? parseIsoDate(input.dueOn ?? null);
  if (!due) {
    return "NOT_STARTED";
  }

  const days = daysUntilDue(due, today);
  const soon = input.dueSoonDays ?? DEFAULT_DUE_SOON_DAYS;
  if (days < 0) return "OVERDUE";
  if (days <= Math.max(soon, 0)) return "DUE";
  return "UPCOMING";
}

export type RecurrenceRule = "MONTHLY" | "WEEKLY" | "QUARTERLY" | "YEARLY";

export function normalizeRecurrenceRule(rule: string | null | undefined): RecurrenceRule | null {
  if (!rule) return null;
  const u = rule.trim().toUpperCase();
  if (u === "MONTHLY" || u === "FREQ=MONTHLY") return "MONTHLY";
  if (u === "WEEKLY" || u === "FREQ=WEEKLY") return "WEEKLY";
  if (u === "QUARTERLY" || u === "FREQ=QUARTERLY") return "QUARTERLY";
  if (u === "YEARLY" || u === "ANNUALLY" || u === "FREQ=YEARLY") return "YEARLY";
  return null;
}

/** Advance next_due for lazy recurrence (no occurrences table). */
export function advanceNextDueOn(
  recurrenceRule: string | null | undefined,
  fromIso: string,
): string | null {
  const rule = normalizeRecurrenceRule(recurrenceRule);
  const from = parseIsoDate(fromIso);
  if (!rule || !from) return null;

  const [y, m, d] = from.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));

  if (rule === "WEEKLY") {
    dt.setUTCDate(dt.getUTCDate() + 7);
  } else if (rule === "MONTHLY") {
    dt.setUTCMonth(dt.getUTCMonth() + 1);
  } else if (rule === "QUARTERLY") {
    dt.setUTCMonth(dt.getUTCMonth() + 3);
  } else if (rule === "YEARLY") {
    dt.setUTCFullYear(dt.getUTCFullYear() + 1);
  }

  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function activeDueOn(row: {
  next_due_on?: string | null;
  due_on?: string | null;
}): string | null {
  return parseIsoDate(row.next_due_on ?? null) ?? parseIsoDate(row.due_on ?? null);
}
