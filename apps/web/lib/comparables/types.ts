import type { DataClassification } from "@/lib/classification/types";
import type { CorpusClass } from "@/lib/supabase/database.types";

export type ComparablePurpose =
  | "BID_STRATEGY"
  | "PRICING_COMPARABLE"
  | "PROPOSAL_CONTENT"
  | "WIN_LOSS_ANALYSIS";

export type ComparableFeatureKey =
  | "buyer"
  | "service"
  | "geography"
  | "procurementRail"
  | "solicitationKind"
  | "scale"
  | "recency"
  | "outcome"
  | "pricing"
  | "proposalContent";

export type ComparableAuthority = {
  organizationId: string;
  corpusClass: CorpusClass | null;
  classifications: DataClassification[];
  historicalLabel: "L&P historical" | "L&P-tied buyer evidence" | "Non-L&P test corpus" | "Unclassified";
  eligible: boolean;
  reason: string;
};

export type PursuitComparableCandidate = {
  id: string;
  organizationId: string;
  title: string;
  clientId: string | null;
  clientName: string | null;
  serviceType: string | null;
  siteLocation: string | null;
  procurementRail: string | null;
  solicitationKind: string | null;
  responseDueOn: string | null;
  createdAt: string;
  weeklyHours: number | null;
  pricingLineCount: number;
  proposalSectionCount: number;
  outcome: string | null;
  authority: ComparableAuthority;
  semanticSimilarity?: number | null;
};

export type ComparableFeature = {
  key: ComparableFeatureKey;
  label: string;
  value: number | null;
  rationale: string;
};

export type ComparableContribution = ComparableFeature & {
  weight: number;
  points: number;
};

export type ComparableScore = {
  algorithmVersion: string;
  purpose: ComparablePurpose;
  candidate: PursuitComparableCandidate;
  structuredScore: number;
  semanticSupplement: number;
  totalScore: number;
  coverageWeight: number;
  contributions: ComparableContribution[];
  rationale: string[];
  caveats: string[];
};
