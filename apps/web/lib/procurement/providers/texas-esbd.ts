import {
  documentsFromRawPayload,
  normalizePublicOpportunity,
  type NormalizedPublicOpportunity,
  type PublicProcurementProvider,
} from "./types";

/** Official Texas Electronic State Business Daily portal (browser search UI — no public solicitation API). */
export const TEXAS_ESBD_PORTAL_URL = "https://www.txsmartbuy.com/esbd";

const LINK_NOTICE =
  "Texas ESBD is LINK_ONLY. There is no public solicitation API — open TxSmartBuy ESBD in a browser, then paste a notice via Manual import. Sync will never scrape ESBD.";

/**
 * Honest Texas ESBD adapter.
 *
 * Capability is LINK_ONLY: the live surface is a browser search UI at txsmartbuy.com/esbd.
 * CPA open-data APIs are not a substitute for ESBD opportunity search. Operators paste notices
 * via `normalizeTexasEsbdEntry` (MANUAL_IMPORT path) — never automated scrape, never invent awards
 * from a solicitation that disappears from the portal.
 */
export function createTexasEsbdProvider(): PublicProcurementProvider {
  return {
    id: "texas_esbd",
    label: "Texas ESBD (TxSmartBuy)",
    mode: "live",
    capability: "LINK_ONLY",
    notice: LINK_NOTICE,
    async search() {
      return {
        provider: "texas_esbd",
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
          "ESBD has no public solicitation API. Portal link is healthy as a bookmark; automated search is not available. Use MANUAL_IMPORT paste for notices.",
      };
    },
  };
}

/**
 * Normalize an operator-pasted ESBD / state notice. Returns null when title is missing.
 * Provider id is texas_esbd so provenance is distinct from generic manual / local.
 */
export function normalizeTexasEsbdEntry(input: {
  title: string;
  source_url?: string | null;
  buyer_name?: string | null;
  solicitation_number?: string | null;
  due_on?: string | null;
  geography?: string | null;
  naics?: string | null;
  procurement_type?: string | null;
}): NormalizedPublicOpportunity | null {
  const title = input.title.trim();
  if (!title) return null;
  const url = input.source_url?.trim() ?? "";
  const sol = input.solicitation_number?.trim() ?? "";
  const externalId =
    sol ||
    url ||
    `texas_esbd:${title.toLowerCase().replace(/\s+/g, "-").slice(0, 120)}`;
  return normalizePublicOpportunity({
    provider: "texas_esbd",
    external_id: externalId,
    title,
    source_url: url || TEXAS_ESBD_PORTAL_URL,
    buyer_name: input.buyer_name,
    solicitation_number: sol || null,
    procurement_type: input.procurement_type ?? null,
    posted_on: null,
    due_on: input.due_on,
    naics: input.naics,
    psc: null,
    set_aside: null,
    geography: input.geography ?? "TX",
    estimated_value: null,
    raw_payload: {
      entered_by: "operator",
      entry_mode: "manual_import",
      portal: TEXAS_ESBD_PORTAL_URL,
      capability: "MANUAL_IMPORT",
    },
  });
}

/** ESBD paste never invents attachments. */
export function documentsForTexasEsbd(notice: NormalizedPublicOpportunity | null) {
  if (!notice) return [];
  return documentsFromRawPayload(notice.raw_payload);
}
