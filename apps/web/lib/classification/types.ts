import type { RetrievalPurpose } from "@/lib/retrieval/purpose";

/** Independent from verification_status and procurement_packages.corpus_class. */
export type DataClassification =
  | "verified_public"
  | "verified_internal"
  | "internal_unverified"
  | "illustrative_demo";

export type ClassificationPurpose = RetrievalPurpose | "DEMO_TEST";

export type ClassificationActor = "AI" | "HUMAN";

export const DATA_CLASSIFICATIONS: readonly DataClassification[] = [
  "verified_public",
  "verified_internal",
  "internal_unverified",
  "illustrative_demo",
] as const;

export const CLASSIFICATION_LABELS: Record<DataClassification, string> = {
  verified_public: "Verified public",
  verified_internal: "Verified internal",
  internal_unverified: "Internal unverified",
  illustrative_demo: "Illustrative demo",
};

export const DEFAULT_DATA_CLASSIFICATION: DataClassification = "internal_unverified";
