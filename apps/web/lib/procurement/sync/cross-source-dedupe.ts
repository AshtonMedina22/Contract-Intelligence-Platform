import {
  softCrossSourceKey,
  type NormalizedPublicOpportunity,
} from "@/lib/procurement/providers";

export type SoftDedupeRow = {
  id: string;
  provider: string;
  external_id: string;
  solicitation_number: string | null;
  buyer_name: string | null;
  duplicate_of_id: string | null;
};

/**
 * Soft cross-source dedupe: when solicitation_number + buyer match confidently,
 * point later rows at the earliest (canonical) id via duplicate_of_id.
 * Never invents merges; never collapses providers; null when not confident.
 */
export function planSoftCrossSourceDuplicates(
  rows: SoftDedupeRow[],
): Map<string, string | null> {
  const byKey = new Map<string, SoftDedupeRow[]>();
  for (const row of rows) {
    const key = softCrossSourceKey(row);
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }

  const plans = new Map<string, string | null>();
  for (const group of byKey.values()) {
    if (group.length < 2) {
      for (const row of group) plans.set(row.id, null);
      continue;
    }
    // Prefer an existing non-null tip; else first row in encounter order is canonical.
    const canonical =
      group.find((row) => row.duplicate_of_id == null)?.id ?? group[0].id;
    for (const row of group) {
      plans.set(row.id, row.id === canonical ? null : canonical);
    }
  }
  return plans;
}

/** Build soft-dedupe candidates from freshly planned notices (pre-id) keyed by provider:external_id. */
export function softKeyForNotice(notice: NormalizedPublicOpportunity): string | null {
  return softCrossSourceKey(notice);
}
