/**
 * Dual-rail evidence model for Ask / Intelligence.
 * Public research must never be written into HUMAN_VERIFIED document_chunks.
 */

export type EvidenceClass =
  | "INTERNAL_VERIFIED"
  | "OFFICIAL_PUBLIC"
  | "EXTERNAL_RESEARCH"
  | "AI_INFERENCE"
  | "UNVERIFIED";

export type EvidenceRail = "internal" | "public";

/** Higher = more authoritative for display / drafting gates. */
export const SOURCE_AUTHORITY: Record<EvidenceClass, number> = {
  INTERNAL_VERIFIED: 100,
  OFFICIAL_PUBLIC: 80,
  EXTERNAL_RESEARCH: 50,
  AI_INFERENCE: 20,
  UNVERIFIED: 10,
};

export type NormalizedEvidence = {
  id: string;
  rail: EvidenceRail;
  evidence_class: EvidenceClass;
  source_authority: number;
  title: string;
  url: string | null;
  internal_ref: string | null;
  document_id: string | null;
  chunk_id: string | null;
  page: number | null;
  excerpt: string;
  published_date: string | null;
  retrieved_at: string;
  verification_status: string;
  entity: string | null;
  topic: string | null;
};

export function makeEvidenceId(prefix: string, key: string): string {
  return `${prefix}:${key}`.slice(0, 180);
}

/** Normalize an internal verified knowledge hit into the shared evidence shape. */
export function normalizeInternalHit(hit: {
  chunk_id: string;
  document_id: string;
  content: string;
  source_page: number | null;
  storage_path?: string | null;
  field?: string | null;
}): NormalizedEvidence {
  return {
    id: makeEvidenceId("chunk", hit.chunk_id),
    rail: "internal",
    evidence_class: "INTERNAL_VERIFIED",
    source_authority: SOURCE_AUTHORITY.INTERNAL_VERIFIED,
    title: hit.storage_path || hit.field || "Verified passage",
    url: null,
    internal_ref: `/ingestion/verification/${hit.document_id}`,
    document_id: hit.document_id,
    chunk_id: hit.chunk_id,
    page: hit.source_page,
    excerpt: hit.content,
    published_date: null,
    retrieved_at: new Date().toISOString(),
    verification_status: "HUMAN_VERIFIED",
    entity: null,
    topic: hit.field ?? null,
  };
}

/** Normalize a structured internal row (pricing/contract/award/locate). */
export function normalizeStructuredRow(opts: {
  prefix: string;
  key: string;
  title: string;
  excerpt: string;
  internal_ref?: string | null;
  document_id?: string | null;
  entity?: string | null;
  topic?: string | null;
  published_date?: string | null;
  verification_status?: string;
}): NormalizedEvidence {
  return {
    id: makeEvidenceId(opts.prefix, opts.key),
    rail: "internal",
    evidence_class: "INTERNAL_VERIFIED",
    source_authority: SOURCE_AUTHORITY.INTERNAL_VERIFIED,
    title: opts.title,
    url: null,
    internal_ref: opts.internal_ref ?? null,
    document_id: opts.document_id ?? null,
    chunk_id: null,
    page: null,
    excerpt: opts.excerpt,
    published_date: opts.published_date ?? null,
    retrieved_at: new Date().toISOString(),
    verification_status: opts.verification_status ?? "STRUCTURED_RECORD",
    entity: opts.entity ?? null,
    topic: opts.topic ?? null,
  };
}

export function sortByAuthority(items: NormalizedEvidence[]): NormalizedEvidence[] {
  return [...items].sort((a, b) => b.source_authority - a.source_authority);
}

export function mergeEvidenceBags(...bags: NormalizedEvidence[][]): NormalizedEvidence[] {
  const map = new Map<string, NormalizedEvidence>();
  for (const bag of bags) {
    for (const item of bag) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
  }
  return sortByAuthority([...map.values()]);
}

export function citationIndexMap(evidence: NormalizedEvidence[]): Map<number, NormalizedEvidence> {
  const map = new Map<number, NormalizedEvidence>();
  evidence.forEach((e, i) => map.set(i + 1, e));
  return map;
}

export type CitationValidation = {
  ok: boolean;
  citedIndexes: number[];
  missingIndexes: number[];
  usedInternal: boolean;
  usedPublic: boolean;
  draftingViolation: boolean;
  message: string;
};

/** Parse [n] citations and ensure they map to the evidence bag. */
export function validateCitations(
  answer: string,
  evidence: NormalizedEvidence[],
  opts?: { draftingPurpose?: boolean },
): CitationValidation {
  const cited = [...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  const unique = [...new Set(cited)].sort((a, b) => a - b);
  const missing = unique.filter((n) => n < 1 || n > evidence.length);
  const used = unique
    .filter((n) => n >= 1 && n <= evidence.length)
    .map((n) => evidence[n - 1]!);
  const usedInternal = used.some((e) => e.rail === "internal");
  const usedPublic = used.some((e) => e.rail === "public");
  const draftingViolation = Boolean(
    opts?.draftingPurpose &&
      used.some(
        (e) =>
          e.evidence_class === "EXTERNAL_RESEARCH" ||
          e.evidence_class === "UNVERIFIED" ||
          e.evidence_class === "AI_INFERENCE",
      ),
  );
  const ok = missing.length === 0 && !draftingViolation;
  let message = "Citations map to retrieved evidence.";
  if (missing.length) message = `Answer cites missing sources: [${missing.join(", ")}].`;
  if (draftingViolation) {
    message =
      "PROPOSAL_DRAFTING cannot treat public/unverified/inference sources as L&P pricing or proposal truth.";
  }
  return {
    ok,
    citedIndexes: unique,
    missingIndexes: missing,
    usedInternal,
    usedPublic,
    draftingViolation,
    message,
  };
}

export function formatEvidenceForPrompt(evidence: NormalizedEvidence[], max = 16): string {
  return evidence
    .slice(0, max)
    .map(
      (e, i) =>
        `[${i + 1}] class=${e.evidence_class} rail=${e.rail} auth=${e.source_authority} title=${e.title}\n` +
        `ref=${e.internal_ref ?? e.url ?? "—"}\n${e.excerpt.slice(0, 900)}`,
    )
    .join("\n\n");
}
