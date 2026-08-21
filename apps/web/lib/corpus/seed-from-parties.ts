/**
 * Seed hunt stubs from existing org buyers (clients) and competitors.
 * These are DISCOVERED stubs — not fabricated documents.
 */

import type { AcquisitionCandidateInput } from "./types";

export type PartySeedRow = {
  id: string;
  name: string;
  kind: "buyer" | "competitor";
};

/**
 * Build DISCOVERED hunt stubs. URLs are search portal bookmarks (LINK_ONLY path),
 * never invented award PDFs.
 */
export function seedCandidatesFromParties(
  organizationId: string,
  parties: PartySeedRow[],
): AcquisitionCandidateInput[] {
  const out: AcquisitionCandidateInput[] = [];
  for (const party of parties) {
    const q = encodeURIComponent(party.name);
    if (party.kind === "buyer") {
      out.push({
        organizationId,
        url: `https://www.txsmartbuy.gov/esbd?q=${q}`,
        title: `ESBD hunt stub — ${party.name}`,
        buyerName: party.name,
        corpusRole: "BUYER_HISTORY",
        sourceAuthority: 3,
        status: "DISCOVERED",
        seedSection: "PARTIES",
        seedId: `PARTY-BUYER-${party.id.slice(0, 8)}`,
        provider: "texas_esbd",
        packageKey: null,
        solicitationHints: { hunt: true, party_id: party.id, party_kind: "buyer" },
        searchLog: [
          {
            query: party.name,
            provider: "texas_esbd",
            attempted_at: new Date().toISOString(),
            result_count: null,
            note: "Hunt stub only — operator/portal search required; no fabricated hits.",
          },
        ],
      });
    } else {
      out.push({
        organizationId,
        url: `https://sam.gov/opportunities?keywords=${q}`,
        title: `SAM hunt stub — competitor ${party.name}`,
        buyerName: null,
        corpusRole: "COMPETITOR_EVIDENCE",
        sourceAuthority: 3,
        status: "DISCOVERED",
        seedSection: "PARTIES",
        seedId: `PARTY-COMP-${party.id.slice(0, 8)}`,
        provider: "sam_gov",
        packageKey: null,
        solicitationHints: { hunt: true, party_id: party.id, party_kind: "competitor" },
        searchLog: [
          {
            query: party.name,
            provider: "sam_gov",
            attempted_at: new Date().toISOString(),
            result_count: null,
            note: "Competitor hunt stub — never label as L&P.",
          },
        ],
      });
    }
  }
  return out;
}
