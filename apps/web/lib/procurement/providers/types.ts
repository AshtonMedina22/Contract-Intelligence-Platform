import type { PublicSourceProvider } from "@/lib/supabase/database.types";

/**
 * A public procurement notice normalized across adapters.
 *
 * Everything here is an external public record. It is never L&P canonical truth, is never
 * written as HUMAN_VERIFIED, and only reaches the database when an operator watches the
 * notice, starts a pursuit from it, or an enabled search profile sync upserts a **live**
 * provider hit (fixture/sample mode is never persisted by sync).
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

/** Attachment / resource link taken verbatim from a provider payload when present. */
export type PublicOpportunityDocument = {
  title: string | null;
  url: string | null;
  description: string | null;
  /** Provider-native type string when present (never invented). */
  type: string | null;
};

export type PublicOpportunityQuery = {
  keywords?: string | null;
  buyer?: string | null;
  naics?: string | null;
  setAside?: string | null;
  state?: string | null;
  postedFrom?: string | null;
  postedTo?: string | null;
  dueWithinDays?: number | null;
  limit?: number;
  /** SAM.gov pagination offset (0-based). Ignored by fixture mode. */
  offset?: number;
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
  /** Total count from the provider when it reports one; null when unknown. */
  totalRecords?: number | null;
};

export type PublicProviderHealth = {
  ok: boolean;
  mode: PublicProviderMode;
  /** Honest operator-facing status — never claims live health without a key/ping. */
  message: string;
};

export type PublicProcurementProvider = {
  id: PublicSourceProvider;
  label: string;
  mode: PublicProviderMode;
  /** Operator-facing honesty banner for this adapter's current mode. */
  notice: string;
  search(query: PublicOpportunityQuery): Promise<PublicProviderSearchResult>;
  /**
   * Fetch one notice by provider-native id. Prefer this name; `getById` remains as a
   * compatibility alias pointing at the same implementation.
   */
  getOpportunity(externalId: string): Promise<NormalizedPublicOpportunity | null>;
  /** @deprecated Prefer getOpportunity — kept for P4 callers. */
  getById?(externalId: string): Promise<NormalizedPublicOpportunity | null>;
  /**
   * List documents/attachments when the provider payload carries them. Returns [] when
   * unknown — never invents links.
   */
  getDocuments(externalId: string): Promise<PublicOpportunityDocument[]>;
  healthCheck(): Promise<PublicProviderHealth>;
};

/** Operator lifecycle for a row that has been persisted to `public_sources`. */
export type PublicSourceStatus =
  | "NEW"
  | "WATCHING"
  | "DISMISSED"
  | "REVIEWING"
  | "CONVERTED_TO_PURSUIT"
  | "CLOSED";

export const PUBLIC_SOURCE_STATUSES: readonly PublicSourceStatus[] = [
  "NEW",
  "WATCHING",
  "DISMISSED",
  "REVIEWING",
  "CONVERTED_TO_PURSUIT",
  "CLOSED",
] as const;

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

/**
 * Stable content hash for sync change detection. Same notice fields → same hash.
 * Uses a simple FNV-1a over a canonical JSON payload (no crypto dependency in the browser).
 */
export function contentHashForNotice(notice: NormalizedPublicOpportunity): string {
  const payload = JSON.stringify({
    provider: notice.provider,
    external_id: notice.external_id,
    title: notice.title,
    source_url: notice.source_url,
    buyer_name: notice.buyer_name,
    solicitation_number: notice.solicitation_number,
    procurement_type: notice.procurement_type,
    posted_on: notice.posted_on,
    due_on: notice.due_on,
    naics: notice.naics,
    psc: notice.psc,
    set_aside: notice.set_aside,
    geography: notice.geography,
    estimated_value: notice.estimated_value,
  });
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/** Dedupe key shared by Discover UI, sync upsert, and pursuit provenance. */
export function publicSourceDedupeKey(
  provider: string,
  externalId: string,
): string {
  return `${provider}:${externalId}`;
}

/**
 * Extract document links from a raw provider payload when present.
 * Never invents URLs — unknown/empty payloads return [].
 */
export function documentsFromRawPayload(
  raw: Record<string, unknown> | null | undefined,
): PublicOpportunityDocument[] {
  if (!raw || typeof raw !== "object") return [];

  const out: PublicOpportunityDocument[] = [];
  const push = (item: unknown) => {
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    const url =
      text(row.url) ??
      text(row.uri) ??
      text(row.href) ??
      text(row.resourceLink) ??
      text(row.downloadUrl);
    const title =
      text(row.title) ??
      text(row.name) ??
      text(row.description) ??
      text(row.type) ??
      null;
    if (!url && !title) return;
    out.push({
      title,
      url,
      description: text(row.description),
      type: text(row.type) ?? text(row.documentType) ?? text(row.mimeType),
    });
  };

  for (const key of [
    "resourceLinks",
    "attachments",
    "documents",
    "links",
    "additionalInfoLink",
  ] as const) {
    const value = raw[key];
    if (Array.isArray(value)) {
      for (const item of value) push(item);
    } else if (typeof value === "string" && value.trim()) {
      out.push({ title: null, url: value.trim(), description: null, type: null });
    } else if (value && typeof value === "object") {
      push(value);
    }
  }

  // Deduplicate by url|title so repeated SAM fields don't multiply rows.
  const seen = new Set<string>();
  return out.filter((doc) => {
    const key = `${doc.url ?? ""}|${doc.title ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Derive the status an operator action should write. Sync uses a separate path that
 * preserves WATCHING / DISMISSED / CONVERTED_TO_PURSUIT / REVIEWING on re-upsert.
 */
export function statusForOperatorAction(
  action: "watch" | "dismiss" | "review" | "start_pursuit" | "restore",
): PublicSourceStatus {
  switch (action) {
    case "watch":
    case "restore":
      return "WATCHING";
    case "dismiss":
      return "DISMISSED";
    case "review":
      return "REVIEWING";
    case "start_pursuit":
      return "CONVERTED_TO_PURSUIT";
  }
}

/** Backfill helper mirroring the migration rules (for unit tests). */
export function backfillStatusFromSignals(input: {
  dismissed_at: string | null;
  watchlisted_at: string | null;
  has_linked_pursuit: boolean;
  due_on: string | null;
  today?: string;
}): PublicSourceStatus {
  if (input.dismissed_at) return "DISMISSED";
  if (input.has_linked_pursuit) return "CONVERTED_TO_PURSUIT";
  if (input.watchlisted_at) return "WATCHING";
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  if (input.due_on && input.due_on < today) return "CLOSED";
  return "NEW";
}

/**
 * Status after a sync upsert of an existing row. Operator lifecycle wins; due-date
 * closure only applies to NEW (and leaves DISMISSED / CONVERTED / WATCHING / REVIEWING alone
 * except NEW→CLOSED when due has passed).
 */
export function statusAfterSync(input: {
  existing: PublicSourceStatus | null;
  due_on: string | null;
  today?: string;
}): PublicSourceStatus {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  if (input.existing === "DISMISSED") return "DISMISSED";
  if (input.existing === "CONVERTED_TO_PURSUIT") return "CONVERTED_TO_PURSUIT";
  if (input.existing === "REVIEWING") return "REVIEWING";
  if (input.existing === "WATCHING") return "WATCHING";
  if (input.due_on && input.due_on < today) return "CLOSED";
  if (input.existing === "CLOSED") {
    // Re-open only when due is still in the future or unknown — otherwise stay CLOSED.
    if (input.due_on && input.due_on >= today) return "NEW";
    if (!input.due_on) return "NEW";
    return "CLOSED";
  }
  return "NEW";
}

/** Client-side filters applied uniformly so fixture and live modes behave the same. */
export function applyLocalFilters(
  rows: NormalizedPublicOpportunity[],
  query: PublicOpportunityQuery,
): NormalizedPublicOpportunity[] {
  const keywords = query.keywords?.trim().toLowerCase() ?? "";
  const buyer = query.buyer?.trim().toLowerCase() ?? "";
  const naics = query.naics?.trim() ?? "";
  const setAside = query.setAside?.trim().toLowerCase() ?? "";
  const state = query.state?.trim().toLowerCase() ?? "";
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
    if (setAside && !(row.set_aside ?? "").toLowerCase().includes(setAside)) return false;
    if (state && !(row.geography ?? "").toLowerCase().includes(state)) return false;
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
