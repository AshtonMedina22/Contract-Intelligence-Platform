/**
 * Daily digest bucketing for automation events.
 * Pure — time-travel friendly via `today` argument.
 */

export type DigestEvent = {
  id?: string;
  kind: string;
  title: string;
  detail?: string | null;
  due_on: string | null;
  severity?: string | null;
  deep_link?: string | null;
  organization_id?: string;
};

export type DigestBuckets = {
  overdue: DigestEvent[];
  today: DigestEvent[];
  next_7: DigestEvent[];
  next_30: DigestEvent[];
  undated: DigestEvent[];
};

function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function daysBetween(todayIso: string, dueIso: string): number {
  const t = parseDateOnly(todayIso);
  const d = parseDateOnly(dueIso);
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}

/**
 * Group open events into overdue / today / next_7 / next_30 / undated.
 * Events beyond 30 days with a due date are omitted from next_30 (still countable via undated=false skip).
 */
export function groupEventsForDigest(
  events: DigestEvent[],
  todayIso: string,
): DigestBuckets {
  const today = todayIso.slice(0, 10);
  const buckets: DigestBuckets = {
    overdue: [],
    today: [],
    next_7: [],
    next_30: [],
    undated: [],
  };

  for (const event of events) {
    if (!event.due_on) {
      buckets.undated.push(event);
      continue;
    }
    const days = daysBetween(today, event.due_on.slice(0, 10));
    if (days < 0) buckets.overdue.push(event);
    else if (days === 0) buckets.today.push(event);
    else if (days <= 7) buckets.next_7.push(event);
    else if (days <= 30) buckets.next_30.push(event);
    // >30: intentionally omitted from digest urgency buckets
  }

  return buckets;
}

export function digestBucketCounts(buckets: DigestBuckets): Record<keyof DigestBuckets, number> {
  return {
    overdue: buckets.overdue.length,
    today: buckets.today.length,
    next_7: buckets.next_7.length,
    next_30: buckets.next_30.length,
    undated: buckets.undated.length,
  };
}

export function buildDailyDigestPayload(input: {
  organizationId: string;
  events: DigestEvent[];
  todayIso: string;
}): {
  organization_id: string;
  as_of: string;
  buckets: DigestBuckets;
  counts: Record<keyof DigestBuckets, number>;
  open_total: number;
  note: string;
} {
  const buckets = groupEventsForDigest(input.events, input.todayIso);
  return {
    organization_id: input.organizationId,
    as_of: input.todayIso.slice(0, 10),
    buckets,
    counts: digestBucketCounts(buckets),
    open_total: input.events.length,
    note: "Humans must act on verification, pricing, proposal approval, and submission. Automation never auto-approves.",
  };
}
