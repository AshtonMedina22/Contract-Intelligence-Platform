import type { PublicSourceProvider } from "@/lib/supabase/database.types";

/**
 * A public procurement notice normalized across adapters.
 *
 * Everything here is an external public record. It is never L&P canonical truth, is never
 * written as HUMAN_VERIFIED, and only reaches the database when an operator watches the
 * notice or starts a pursuit from it.
 */
export type NormalizedPublicOpportunity = {
  provider: PublicSourceProvider;
  external_id: string;
  title: string;
  source_url: string | null;
  buyer_name: string | null;
  solicitation_number: string | null;
  procurement_type: string | null;
  posted_on: string | null;
  due_on: string | null;
  naics: string | null;
  psc: string | null;
  set_aside: string | null;
  geography: string | null;
  /** Only set when the provider itself supplies an amount. Never inferred. */
  estimated_value: number | null;
  raw_payload: Record<string, unknown>;
};

export type PublicOpportunityQuery = {
  keywords?: string | null;
  buyer?: string | null;
  naics?: string | null;
  postedFrom?: string | null;
  postedTo?: string | null;
  dueWithinDays?: number | null;
  limit?: number;
};

export type PublicProviderMode = "live" | "fixture";

export type PublicProviderSearchResult = {
  provider: PublicSourceProvider;
  /** `fixture` means sample data — the results are not live public notices. */
  mode: PublicProviderMode;
  /** Operator-facing explanation of what this adapter is currently doing. */
  notice: string;
  results: NormalizedPublicOpportunity[];
  error: string | null;
};

export type PublicProcurementProvider = {
  id: PublicSourceProvider;
  label: string;
  mode: PublicProviderMode;
  /** Operator-facing honesty banner for this adapter's current mode. */
  notice: string;
  search(query: PublicOpportunityQuery): Promise<PublicProviderSearchResult>;
  getById?(externalId: string): Promise<NormalizedPublicOpportunity | null>;
};

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Coerce a provider date-ish value to an ISO `YYYY-MM-DD` date, or null. */
export function toIsoDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const isoish = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (isoish) return `${isoish[1]}-${isoish[2]}-${isoish[3]}`;
  const usish = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (usish) return `${usish[3]}-${usish[1]}-${usish[2]}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

/**
 * Only numeric provider-supplied amounts survive. Anything unparseable becomes null rather
 * than a guessed value — we never invent an estimated contract value.
 */
export function toProviderAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = text(value);
  if (!raw) return null;
  const parsed = Number.parseFloat(raw.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Build a normalized notice from loosely shaped provider fields. Missing values stay null so
 * downstream UI can show an honest gap instead of a filler string.
 */
export function normalizePublicOpportunity(input: {
  provider: PublicSourceProvider;
  external_id: unknown;
  title: unknown;
  source_url?: unknown;
  buyer_name?: unknown;
  solicitation_number?: unknown;
  procurement_type?: unknown;
  posted_on?: unknown;
  due_on?: unknown;
  naics?: unknown;
  psc?: unknown;
  set_aside?: unknown;
  geography?: unknown;
  estimated_value?: unknown;
  raw_payload?: unknown;
}): NormalizedPublicOpportunity | null {
  const external_id = text(input.external_id);
  const title = text(input.title);
  if (!external_id || !title) return null;

  return {
    provider: input.provider,
    external_id,
    title,
    source_url: text(input.source_url),
    buyer_name: text(input.buyer_name),
    solicitation_number: text(input.solicitation_number),
    procurement_type: text(input.procurement_type),
    posted_on: toIsoDate(input.posted_on),
    due_on: toIsoDate(input.due_on),
    naics: text(input.naics),
    psc: text(input.psc),
    set_aside: text(input.set_aside),
    geography: text(input.geography),
    estimated_value: toProviderAmount(input.estimated_value),
    raw_payload:
      input.raw_payload && typeof input.raw_payload === "object"
        ? (input.raw_payload as Record<string, unknown>)
        : {},
  };
}

/** Client-side filters applied uniformly so fixture and live modes behave the same. */
export function applyLocalFilters(
  rows: NormalizedPublicOpportunity[],
  query: PublicOpportunityQuery,
): NormalizedPublicOpportunity[] {
  const keywords = query.keywords?.trim().toLowerCase() ?? "";
  const buyer = query.buyer?.trim().toLowerCase() ?? "";
  const naics = query.naics?.trim() ?? "";
  const dueWithinDays = query.dueWithinDays ?? null;
  const dueCutoff =
    dueWithinDays != null && dueWithinDays > 0
      ? Date.now() + dueWithinDays * 24 * 60 * 60 * 1000
      : null;

  return rows.filter((row) => {
    if (keywords) {
      const blob = [row.title, row.buyer_name, row.solicitation_number, row.procurement_type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!keywords.split(/\s+/).every((token) => blob.includes(token))) return false;
    }
    if (buyer && !(row.buyer_name ?? "").toLowerCase().includes(buyer)) return false;
    if (naics && !(row.naics ?? "").startsWith(naics)) return false;
    if (query.postedFrom && row.posted_on && row.posted_on < query.postedFrom) return false;
    if (query.postedTo && row.posted_on && row.posted_on > query.postedTo) return false;
    if (dueCutoff != null) {
      if (!row.due_on) return false;
      const due = new Date(`${row.due_on}T23:59:59Z`).getTime();
      if (Number.isNaN(due) || due > dueCutoff) return false;
    }
    return true;
  });
}
