/**
 * Pure heuristic proposal-section extractor.
 * Always emits AI_EXTRACTED DTOs — never HUMAN_VERIFIED / APPROVED.
 */

import {
  matchHeadingToSectionKey,
  sectionKeyLabel,
  type ProposalSectionKey,
} from "@/lib/content/taxonomy";
import type { ContentVerificationStatus } from "@/lib/content/reuse-policy";

export type PageMarker = { page: number; offset: number };

export type ExtractedSectionDto = {
  section_key: ProposalSectionKey;
  title: string;
  body_text: string;
  verification_status: "AI_EXTRACTED";
  reuse_status: null;
  page_start: number | null;
  page_end: number | null;
  source_page: number | null;
  provenance: {
    proposal_id?: string | null;
    proposal_version_id?: string | null;
    buyer_name?: string | null;
    opportunity_id?: string | null;
    document_id?: string | null;
    source_section: string;
    source_text_excerpt: string;
  };
};

export type ExtractSectionsInput = {
  text: string;
  pageMarkers?: PageMarker[];
  documentId?: string | null;
  opportunityId?: string | null;
  buyerName?: string | null;
  proposalId?: string | null;
  proposalVersionId?: string | null;
};

function pageAtOffset(markers: PageMarker[] | undefined, offset: number): number | null {
  if (!markers?.length) return null;
  const sorted = [...markers].sort((a, b) => a.offset - b.offset);
  let page = sorted[0]?.page ?? null;
  for (const m of sorted) {
    if (m.offset <= offset) page = m.page;
    else break;
  }
  return page;
}

type HeadingHit = { key: ProposalSectionKey; title: string; start: number; headingEnd: number };

function findHeadings(text: string): HeadingHit[] {
  const hits: HeadingHit[] = [];
  const lines = text.split(/\r?\n/);
  let offset = 0;
  for (const line of lines) {
    const key = matchHeadingToSectionKey(line);
    if (key) {
      const trimmed = line.trim();
      hits.push({
        key,
        title: trimmed || sectionKeyLabel(key),
        start: offset,
        headingEnd: offset + line.length,
      });
    }
    offset += line.length + 1;
  }
  return hits;
}

/**
 * Split proposal text into taxonomy-matched sections.
 * Unmatched content is dropped (no invented keys). Never sets HUMAN_VERIFIED / APPROVED.
 */
export function extractProposalSections(input: ExtractSectionsInput): ExtractedSectionDto[] {
  const text = input.text ?? "";
  if (!text.trim()) return [];

  const headings = findHeadings(text);
  if (!headings.length) return [];

  const results: ExtractedSectionDto[] = [];
  const seen = new Set<ProposalSectionKey>();

  for (let i = 0; i < headings.length; i++) {
    const hit = headings[i]!;
    const next = headings[i + 1];
    if (seen.has(hit.key)) continue;
    seen.add(hit.key);

    const bodyStart = hit.headingEnd;
    const bodyEnd = next ? next.start : text.length;
    const body = text.slice(bodyStart, bodyEnd).trim();
    if (!body) continue;

    const pageStart = pageAtOffset(input.pageMarkers, hit.start);
    const pageEnd = pageAtOffset(input.pageMarkers, Math.max(bodyStart, bodyEnd - 1));

    const verification_status = "AI_EXTRACTED" satisfies ContentVerificationStatus;
    results.push({
      section_key: hit.key,
      title: hit.title.slice(0, 200),
      body_text: body.slice(0, 50000),
      verification_status,
      reuse_status: null,
      page_start: pageStart,
      page_end: pageEnd,
      source_page: pageStart,
      provenance: {
        proposal_id: input.proposalId ?? null,
        proposal_version_id: input.proposalVersionId ?? null,
        buyer_name: input.buyerName ?? null,
        opportunity_id: input.opportunityId ?? null,
        document_id: input.documentId ?? null,
        source_section: hit.title.slice(0, 200),
        source_text_excerpt: body.slice(0, 500),
      },
    });
  }

  return results;
}
