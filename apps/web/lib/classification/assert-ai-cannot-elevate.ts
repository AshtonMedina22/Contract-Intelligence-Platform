import type { ClassificationActor, DataClassification } from "./types";

/**
 * AI/extraction code may copy an existing classification, but may never change it.
 * In particular it cannot assign either verified_* authority.
 */
export function assertAiCannotElevate(
  from: DataClassification,
  to: DataClassification,
  actor: ClassificationActor,
): void {
  if (actor === "AI" && from !== to) {
    throw new Error(
      `AI cannot change data classification (${from} -> ${to}). Use the authorized human classification action.`,
    );
  }
}
