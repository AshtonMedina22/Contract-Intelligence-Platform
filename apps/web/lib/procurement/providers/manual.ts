import {
  documentsFromRawPayload,
  normalizePublicOpportunity,
  type NormalizedPublicOpportunity,
  type PublicProcurementProvider,
} from "./types";

const MANUAL_NOTICE =
  "Operator-entered public notice (state / local / ISD / portal). Nothing is searched or scraped — the URL and title are exactly what was pasted. Capability: MANUAL_IMPORT.";

/**
 * Thin adapter for a notice an operator found themselves (state portal, ESBD, ISD, buyer website).
 * It has no search surface: the operator supplies the record. Capability is MANUAL_IMPORT.
 */
export function createManualProvider(): PublicProcurementProvider {
  return {
    id: "manual",
    label: "Manual research",
    mode: "live",
    capability: "MANUAL_IMPORT",
    notice: MANUAL_NOTICE,
    async search() {
      return {
        provider: "manual",
        mode: "live",
        capability: "MANUAL_IMPORT",
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
        capability: "MANUAL_IMPORT",
        message: "Manual entry adapter healthy — no remote dependency.",
      };
    },
  };
}

export type ManualEntryKind = "manual" | "state" | "local";

/** Build a normalized notice from operator-pasted fields. Returns null when title is missing. */
export function normalizeManualEntry(input: {
  title: string;
  source_url?: string | null;
  buyer_name?: string | null;
  solicitation_number?: string | null;
  due_on?: string | null;
  geography?: string | null;
  naics?: string | null;
  /** state / local / ISD family tags for provenance; default manual. */
  kind?: ManualEntryKind;
}): NormalizedPublicOpportunity | null {
  const title = input.title.trim();
  if (!title) return null;
  const url = input.source_url?.trim() ?? "";
  const kind: ManualEntryKind = input.kind ?? "manual";
  const provider = kind === "state" || kind === "local" ? kind : "manual";
  const externalId = url || `${provider}:${title.toLowerCase().replace(/\s+/g, "-").slice(0, 120)}`;
  return normalizePublicOpportunity({
    provider,
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
    raw_payload: {
      entered_by: "operator",
      entry_mode: "manual_import",
      capability: "MANUAL_IMPORT",
      kind,
    },
  });
}

/** Local / ISD paste helper — stores provider=`local` for soft cross-source provenance. */
export function normalizeLocalManualEntry(
  input: Omit<Parameters<typeof normalizeManualEntry>[0], "kind">,
): NormalizedPublicOpportunity | null {
  return normalizeManualEntry({ ...input, kind: "local" });
}

/** Manual notices never invent attachments — only return links present in raw_payload. */
export function documentsForManual(notice: NormalizedPublicOpportunity | null) {
  if (!notice) return [];
  return documentsFromRawPayload(notice.raw_payload);
}
