import {
  normalizePublicOpportunity,
  type NormalizedPublicOpportunity,
  type PublicProcurementProvider,
} from "./types";

const LINK_NOTICE =
  "HTML listing portals are LINK_ONLY until an allowlisted public API or feed exists. This adapter does not scrape pages. Paste notices via Manual import.";

/**
 * Optional HTML listing adapter — LINK_ONLY by design.
 * Do not scrape illegally; stay LINK_ONLY / MANUAL until ToS-safe allowlisted automation exists.
 */
export function createHtmlListingProvider(): PublicProcurementProvider {
  return {
    id: "html_listing",
    label: "HTML portal (link only)",
    mode: "live",
    capability: "LINK_ONLY",
    notice: LINK_NOTICE,
    async search() {
      return {
        provider: "html_listing",
        mode: "live",
        capability: "LINK_ONLY",
        notice: LINK_NOTICE,
        results: [],
        error: null,
        totalRecords: null,
      };
    },
    async getOpportunity() {
      return null;
    },
    async getById() {
      return null;
    },
    async getDocuments() {
      return [];
    },
    async healthCheck() {
      return {
        ok: true,
        mode: "live",
        capability: "LINK_ONLY",
        httpStatus: null,
        message:
          "HTML listing adapter is LINK_ONLY — no scrape. Configure an allowlisted RSS/JSON/Socrata source for automation.",
      };
    },
  };
}

/** Operator paste for a local/ISD HTML portal notice (still MANUAL_IMPORT provenance). */
export function normalizeHtmlListingEntry(input: {
  title: string;
  source_url?: string | null;
  buyer_name?: string | null;
  solicitation_number?: string | null;
  due_on?: string | null;
  geography?: string | null;
}): NormalizedPublicOpportunity | null {
  const title = input.title.trim();
  if (!title) return null;
  const url = input.source_url?.trim() ?? "";
  const externalId =
    url || `html_listing:${title.toLowerCase().replace(/\s+/g, "-").slice(0, 120)}`;
  return normalizePublicOpportunity({
    provider: "html_listing",
    external_id: externalId,
    title,
    source_url: url || null,
    buyer_name: input.buyer_name,
    solicitation_number: input.solicitation_number,
    procurement_type: null,
    posted_on: null,
    due_on: input.due_on,
    naics: null,
    geography: input.geography,
    estimated_value: null,
    raw_payload: {
      entered_by: "operator",
      entry_mode: "manual_import",
      capability: "MANUAL_IMPORT",
      scrape: false,
    },
  });
}
