import {
  documentsFromRawPayload,
  normalizePublicOpportunity,
  type NormalizedPublicOpportunity,
  type PublicProcurementProvider,
} from "./types";

const MANUAL_NOTICE =
  "Operator-entered public notice. Nothing is searched or inferred — the URL and title are exactly what was pasted.";

/**
 * Thin adapter for a notice an operator found themselves (state portal, ESBD, buyer website).
 * It has no search surface: the operator supplies the record.
 */
export function createManualProvider(): PublicProcurementProvider {
  return {
    id: "manual",
    label: "Manual research",
    mode: "live",
    notice: MANUAL_NOTICE,
    async search() {
      return {
        provider: "manual",
        mode: "live",
        notice: MANUAL_NOTICE,
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
        message: "Manual entry adapter healthy — no remote dependency.",
      };
    },
  };
}

/** Build a normalized notice from operator-pasted fields. Returns null when title is missing. */
export function normalizeManualEntry(input: {
  title: string;
  source_url?: string | null;
  buyer_name?: string | null;
  solicitation_number?: string | null;
  due_on?: string | null;
  geography?: string | null;
  naics?: string | null;
}): NormalizedPublicOpportunity | null {
  const title = input.title.trim();
  if (!title) return null;
  const url = input.source_url?.trim() ?? "";
  const externalId = url || `manual:${title.toLowerCase().replace(/\s+/g, "-").slice(0, 120)}`;
  return normalizePublicOpportunity({
    provider: "manual",
    external_id: externalId,
    title,
    source_url: url || null,
    buyer_name: input.buyer_name,
    solicitation_number: input.solicitation_number,
    procurement_type: null,
    posted_on: null,
    due_on: input.due_on,
    naics: input.naics,
    psc: null,
    set_aside: null,
    geography: input.geography,
    estimated_value: null,
    raw_payload: { entered_by: "operator", entry_mode: "manual" },
  });
}

/** Manual notices never invent attachments — only return links present in raw_payload. */
export function documentsForManual(notice: NormalizedPublicOpportunity | null) {
  if (!notice) return [];
  return documentsFromRawPayload(notice.raw_payload);
}
