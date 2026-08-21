/**
 * F23 — Public Procurement Corpus Acquisition types.
 * Never auto HUMAN_VERIFIED. Authority 3 = discovery lead only.
 */

export type AcquisitionCorpusRole =
  | "L_AND_P_DIRECT"
  | "BUYER_HISTORY"
  | "COMPETITOR_EVIDENCE"
  | "COMPARABLE_SECURITY"
  | "REFERENCE_DATA";

export type AcquisitionCandidateStatus =
  | "DISCOVERED"
  | "QUEUED"
  | "ACQUIRED"
  | "DUPLICATE"
  | "INGESTED"
  | "REVIEW_READY"
  | "MANUAL_IMPORT"
  | "LINK_ONLY"
  | "REJECTED"
  | "FAILED";

/** 1=primary official; 2=secondary official/open-data; 3=news/search discovery lead. */
export type SourceAuthority = 1 | 2 | 3;

export type CorpusClass = "A_LP_ORIGINATED" | "B_LP_TIED" | "C_COMPETITOR_TEST";

export type RegistrySeedRecord = {
  seedId: string;
  section: string;
  url: string;
  title: string;
  buyerName: string | null;
  solicitationHints: Record<string, unknown>;
  /** Hint from registry prose; classifyRole may override conservatively. */
  roleHint: AcquisitionCorpusRole | null;
  authorityHint: SourceAuthority | null;
  downloadableHint: boolean;
};

export type SearchLogEntry = {
  query: string;
  provider: string;
  attempted_at: string;
  result_count: number | null;
  note?: string;
};

export type AcquisitionCandidateInput = {
  organizationId: string;
  url: string;
  title?: string | null;
  buyerName?: string | null;
  solicitationNumber?: string | null;
  solicitationHints?: Record<string, unknown>;
  corpusRole: AcquisitionCorpusRole;
  sourceAuthority: SourceAuthority;
  status?: AcquisitionCandidateStatus;
  seedSection?: string | null;
  seedId?: string | null;
  provider?: string | null;
  externalId?: string | null;
  packageKey?: string | null;
  searchLog?: SearchLogEntry[];
  lastError?: string | null;
};

export type FetchCandidateResult =
  | {
      ok: true;
      status: "ACQUIRED" | "LINK_ONLY" | "MANUAL_IMPORT";
      bytes: Uint8Array | null;
      sha256: string | null;
      contentType: string | null;
      byteSize: number | null;
      localPath: string | null;
      filename: string | null;
      note?: string;
    }
  | {
      ok: false;
      status: "FAILED" | "MANUAL_IMPORT" | "LINK_ONLY" | "REJECTED";
      error: string;
      contentType?: string | null;
    };

export type IngestCandidateResult = {
  duplicate: boolean;
  documentId: string | null;
  documentVersionId: string | null;
  sha256: string;
  storagePath: string | null;
  status: "INGESTED" | "DUPLICATE" | "FAILED";
  error?: string;
  verificationStatus: "AI_EXTRACTED";
};

export const ROLE_TO_CORPUS_CLASS: Record<AcquisitionCorpusRole, CorpusClass | null> = {
  L_AND_P_DIRECT: "A_LP_ORIGINATED",
  BUYER_HISTORY: "B_LP_TIED",
  COMPETITOR_EVIDENCE: "C_COMPETITOR_TEST",
  COMPARABLE_SECURITY: "C_COMPETITOR_TEST",
  /** Structured reference (USAspending etc.) — never a fake L&P package class. */
  REFERENCE_DATA: null,
};

export const LP_NAME_RE =
  /\bL\s*&\s*P\b|\bL\s+and\s+P\b|\bL\s*&\s*P\s+Global\s+Security\b|\bLP\s+Global\s+Security\b/i;

export const DOWNLOADABLE_EXT_RE = /\.(pdf|docx?|xlsx?|xls)(\?|$)/i;
