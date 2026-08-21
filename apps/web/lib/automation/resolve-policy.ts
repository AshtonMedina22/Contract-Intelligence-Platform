/**
 * Pure resolve policy: when the underlying condition is fixed, clear the open event.
 */

import type { AutomationKind } from "./kinds";

export type ResolveConditionInput = {
  kind: AutomationKind | string;
  /** True when the source condition that created the alert still holds. */
  conditionStillActive: boolean;
  /** Open event currently unresolved. */
  isOpen: boolean;
};

export type ResolveDecision =
  | { action: "keep_open"; reason: string }
  | { action: "resolve"; reason: string }
  | { action: "noop"; reason: string };

/**
 * If the condition that caused the alert is no longer true, resolve it.
 * Does not mutate — callers apply acknowledged_at / resolved_at / notification status.
 */
export function decideResolve(input: ResolveConditionInput): ResolveDecision {
  if (!input.isOpen) {
    return { action: "noop", reason: "Event already resolved or acknowledged." };
  }
  if (input.conditionStillActive) {
    return { action: "keep_open", reason: "Underlying condition still active." };
  }
  return {
    action: "resolve",
    reason: "Condition cleared — set resolved_at (and acknowledged_at for Phase 6 compat).",
  };
}

/**
 * When a deadline date changes, keep the same dedupe_key (entity-scoped) and update due_on.
 * Re-key only when the entity identity changes.
 */
export function deadlineDedupeKey(kind: string, entityId: string): string {
  return `${kind}:${entityId}`;
}

export function shouldRekeyOnDeadlineChange(
  previousDueOn: string | null,
  nextDueOn: string | null,
): { rekey: false; updateDueOn: boolean } {
  // Same dedupe_key; due_on is updated in place — never create a duplicate open event.
  return {
    rekey: false,
    updateDueOn: previousDueOn !== nextDueOn,
  };
}
