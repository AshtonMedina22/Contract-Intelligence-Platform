import {
  contentHashForNotice,
  getAutomatedSyncProviders,
  publicSourceDedupeKey,
  statusAfterSync,
  type NormalizedPublicOpportunity,
  type ProviderCapability,
  type PublicOpportunityQuery,
  type PublicSourceStatus,
} from "@/lib/procurement/providers";
import {
  planSoftCrossSourceDuplicates,
  type SoftDedupeRow,
} from "@/lib/procurement/sync/cross-source-dedupe";
import type { PublicSourceProvider } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SearchProfileCriteria = {
  keywords?: string | null;
  buyer?: string | null;
  naics?: string | null;
  set_aside?: string | null;
  setAside?: string | null;
  state?: string | null;
  postedFrom?: string | null;
  postedTo?: string | null;
  dueWithinDays?: number | null;
  limit?: number | null;
  /** F16: optional provider filter (e.g. socrata | rss | json_feed | sam_gov). */
  provider?: string | null;
  capability?: ProviderCapability | null;
  agencyType?: string | null;
  portalUrl?: string | null;
  socrata?: {
    domain?: string;
    datasetId?: string;
    fieldMap?: Record<string, string>;
  } | null;
  rssUrl?: string | null;
  jsonFeedUrl?: string | null;
};

export type OpportunitySearchProfileRow = {
  id: string;
  organization_id: string;
  name: string;
  enabled: boolean;
  criteria: SearchProfileCriteria | Record<string, unknown> | null;
  schedule_cron: string | null;
  last_run_at: string | null;
  last_error: string | null;
};

/** Map stored profile criteria onto the shared provider query shape. */
export function criteriaToQuery(
  criteria: SearchProfileCriteria | Record<string, unknown> | null | undefined,
): PublicOpportunityQuery {
  const c = (criteria ?? {}) as SearchProfileCriteria;
  const dueRaw =
    typeof c.dueWithinDays === "number"
      ? c.dueWithinDays
      : Number.parseInt(String(c.dueWithinDays ?? ""), 10);
  const limitRaw =
    typeof c.limit === "number" ? c.limit : Number.parseInt(String(c.limit ?? ""), 10);
  return {
    keywords: typeof c.keywords === "string" ? c.keywords : null,
    buyer: typeof c.buyer === "string" ? c.buyer : null,
    naics: typeof c.naics === "string" ? c.naics : null,
    setAside:
      typeof c.setAside === "string"
        ? c.setAside
        : typeof c.set_aside === "string"
          ? c.set_aside
          : null,
    state: typeof c.state === "string" ? c.state : null,
    postedFrom: typeof c.postedFrom === "string" ? c.postedFrom : null,
    postedTo: typeof c.postedTo === "string" ? c.postedTo : null,
    dueWithinDays: Number.isFinite(dueRaw) && dueRaw > 0 ? dueRaw : null,
    limit: Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 25,
  };
}

export type SyncUpsertPlan = {
  notice: NormalizedPublicOpportunity;
  content_hash: string;
  status: PublicSourceStatus;
  is_new: boolean;
  content_changed: boolean;
  addendum_refresh_needed: boolean;
  capability: ProviderCapability;
};

const WATCHED_STATUSES: ReadonlySet<PublicSourceStatus> = new Set([
  "WATCHING",
  "REVIEWING",
  "CONVERTED_TO_PURSUIT",
]);

/**
 * Plan the upsert for one provider hit against an existing row map.
 * Never invents notices — caller must only pass provider-returned rows.
 * On content_hash change for watched rows → addendum_refresh_needed (does NOT auto F11).
 */
export function planSyncUpsert(
  notice: NormalizedPublicOpportunity,
  existingByKey: Map<
    string,
    {
      status: PublicSourceStatus;
      content_hash: string | null;
      addendum_refresh_needed?: boolean;
    }
  >,
  today?: string,
  capability: ProviderCapability = "AUTOMATED",
): SyncUpsertPlan {
  const key = publicSourceDedupeKey(notice.provider, notice.external_id);
  const existing = existingByKey.get(key) ?? null;
  const content_hash = contentHashForNotice(notice);
  const content_changed =
    existing != null &&
    existing.content_hash != null &&
    existing.content_hash !== content_hash;
  const status = statusAfterSync({
    existing: existing?.status ?? null,
    due_on: notice.due_on,
    today,
  });
  let addendum_refresh_needed = false;
  if (existing == null) {
    addendum_refresh_needed = false;
  } else if (content_changed && WATCHED_STATUSES.has(existing.status)) {
    // Cue only — never auto-creates F11 change runs.
    addendum_refresh_needed = true;
  } else {
    addendum_refresh_needed = Boolean(existing.addendum_refresh_needed);
  }

  return {
    notice,
    content_hash,
    status,
    is_new: existing == null,
    content_changed,
    addendum_refresh_needed,
    capability,
  };
}

/**
 * Collapse a search result set to unique (provider, external_id) — first wins.
 * Used by sync and by acceptance tests to prove dedupe before write.
 */
export function dedupeNotices(
  notices: NormalizedPublicOpportunity[],
): NormalizedPublicOpportunity[] {
  const seen = new Set<string>();
  const out: NormalizedPublicOpportunity[] = [];
  for (const notice of notices) {
    const key = publicSourceDedupeKey(notice.provider, notice.external_id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(notice);
  }
  return out;
}

export type ProfileSyncResult = {
  profileId: string;
  profileName: string;
  searched: number;
  upserted: number;
  skippedDuplicateInBatch: number;
  softDuplicatesLinked: number;
  addendumRefreshFlags: number;
  errors: string[];
};

type AdminClient = SupabaseClient;

type ExistingRow = {
  status: PublicSourceStatus;
  content_hash: string | null;
  id: string;
  addendum_refresh_needed: boolean;
  solicitation_number: string | null;
  buyer_name: string | null;
  duplicate_of_id: string | null;
};

async function loadExistingKeys(
  admin: AdminClient,
  organizationId: string,
  notices: NormalizedPublicOpportunity[],
): Promise<Map<string, ExistingRow>> {
  const map = new Map<string, ExistingRow>();
  if (notices.length === 0) return map;

  const providers = [...new Set(notices.map((n) => n.provider))];
  const externalIds = [...new Set(notices.map((n) => n.external_id))];

  const { data, error } = await admin
    .from("public_sources")
    .select(
      "id, provider, external_id, status, content_hash, addendum_refresh_needed, solicitation_number, buyer_name, duplicate_of_id",
    )
    .eq("organization_id", organizationId)
    .in("provider", providers)
    .in("external_id", externalIds);

  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    map.set(publicSourceDedupeKey(row.provider, row.external_id), {
      id: row.id,
      status: row.status as PublicSourceStatus,
      content_hash: row.content_hash,
      addendum_refresh_needed: Boolean(row.addendum_refresh_needed),
      solicitation_number: row.solicitation_number,
      buyer_name: row.buyer_name,
      duplicate_of_id: row.duplicate_of_id,
    });
  }
  return map;
}

async function upsertPlanned(
  admin: AdminClient,
  organizationId: string,
  plan: SyncUpsertPlan,
  sourceHealth: Record<string, unknown> | null,
): Promise<string | null> {
  const notice = plan.notice;
  const now = new Date().toISOString();
  // Intentionally omit watchlisted_at / dismissed_at / created_by so sync cannot invent
  // operator signals or clear them on conflict update.
  const { data, error } = await admin
    .from("public_sources")
    .upsert(
      {
        organization_id: organizationId,
        provider: notice.provider as PublicSourceProvider,
        external_id: notice.external_id,
        source_url: notice.source_url,
        title: notice.title,
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
        raw_payload: notice.raw_payload,
        retrieved_at: now,
        content_hash: plan.content_hash,
        status: plan.status,
        capability: plan.capability,
        addendum_refresh_needed: plan.addendum_refresh_needed,
        content_changed_at: plan.content_changed ? now : undefined,
        source_health: sourceHealth,
        updated_at: now,
      },
      { onConflict: "organization_id,provider,external_id" },
    )
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

/**
 * Sync may only persist live AUTOMATED provider hits. Fixture / sample / LINK_ONLY /
 * MANUAL_IMPORT adapters are for Discover UI or operator paste — never cron upsert.
 */
export function isLiveSyncProvider(provider: {
  id: string;
  mode: string;
  capability?: string;
}): boolean {
  if (provider.capability && provider.capability !== "AUTOMATED") return false;
  if (provider.mode === "fixture") return false;
  if (provider.id === "fixture") return false;
  return provider.mode === "live";
}

function healthSnapshot(
  providerId: string,
  health: {
    ok: boolean;
    mode: string;
    capability: string;
    message: string;
    httpStatus?: number | null;
  },
): Record<string, unknown> {
  return {
    provider: providerId,
    ok: health.ok,
    mode: health.mode,
    capability: health.capability,
    message: health.message,
    httpStatus: health.httpStatus ?? null,
    checked_at: new Date().toISOString(),
  };
}

/**
 * Run one enabled search profile: AUTOMATED live providers → dedupe → upsert.
 * Never invents rows. Fixture / non-AUTOMATED modes are skipped (fail closed).
 * content_hash change on WATCHING → addendum_refresh_needed (does not auto F11).
 */
export async function runProfileSync(
  admin: AdminClient,
  profile: OpportunitySearchProfileRow,
): Promise<ProfileSyncResult> {
  const result: ProfileSyncResult = {
    profileId: profile.id,
    profileName: profile.name,
    searched: 0,
    upserted: 0,
    skippedDuplicateInBatch: 0,
    softDuplicatesLinked: 0,
    addendumRefreshFlags: 0,
    errors: [],
  };

  const query = criteriaToQuery(profile.criteria);
  const criteria = (profile.criteria ?? {}) as SearchProfileCriteria;
  const providerFilter =
    typeof criteria.provider === "string" ? criteria.provider.trim() : null;

  let providers = getAutomatedSyncProviders();
  if (providerFilter) {
    providers = providers.filter((p) => p.id === providerFilter || p.id === "fixture");
  }

  const collected: NormalizedPublicOpportunity[] = [];
  const healthByProvider: Record<string, Record<string, unknown>> = {};

  for (const provider of providers) {
    if (!isLiveSyncProvider(provider)) {
      result.errors.push(
        `${provider.id}: SKIP — capability=${provider.capability} mode=${provider.mode}; sync persists AUTOMATED live hits only (Discover may still show samples without writing on view)`,
      );
      try {
        const health = await provider.healthCheck();
        healthByProvider[provider.id] = healthSnapshot(provider.id, health);
      } catch {
        /* health optional on skip */
      }
      continue;
    }
    try {
      const health = await provider.healthCheck();
      healthByProvider[provider.id] = healthSnapshot(provider.id, health);
      const search = await provider.search(query);
      if (search.mode === "fixture" || search.provider === "fixture") {
        result.errors.push(
          `${provider.id}: SKIP — search returned fixture mode; refusing to persist sample notices`,
        );
        continue;
      }
      if (search.capability && search.capability !== "AUTOMATED") {
        result.errors.push(
          `${provider.id}: SKIP — search capability ${search.capability} is not AUTOMATED`,
        );
        continue;
      }
      if (search.error) result.errors.push(`${provider.id}: ${search.error}`);
      collected.push(
        ...search.results.filter(
          (row) => row.provider !== "fixture" && !row.external_id.startsWith("FIXTURE-"),
        ),
      );
    } catch (err) {
      result.errors.push(
        err instanceof Error
          ? `${provider.id}: ${err.message}`
          : `${provider.id}: search failed`,
      );
    }
  }

  result.searched = collected.length;
  const unique = dedupeNotices(collected);
  result.skippedDuplicateInBatch = collected.length - unique.length;

  const profileHealth = {
    checked_at: new Date().toISOString(),
    providers: healthByProvider,
  };

  try {
    const existing = await loadExistingKeys(admin, profile.organization_id, unique);
    const upsertedIds: SoftDedupeRow[] = [];

    for (const notice of unique) {
      const plan = planSyncUpsert(notice, existing, undefined, "AUTOMATED");
      const providerHealth = healthByProvider[notice.provider] ?? null;
      const id = await upsertPlanned(admin, profile.organization_id, plan, providerHealth);
      result.upserted += 1;
      if (plan.addendum_refresh_needed) result.addendumRefreshFlags += 1;
      const key = publicSourceDedupeKey(notice.provider, notice.external_id);
      const prior = existing.get(key);
      existing.set(key, {
        id: id ?? prior?.id ?? "",
        status: plan.status,
        content_hash: plan.content_hash,
        addendum_refresh_needed: plan.addendum_refresh_needed,
        solicitation_number: notice.solicitation_number,
        buyer_name: notice.buyer_name,
        duplicate_of_id: prior?.duplicate_of_id ?? null,
      });
      if (id) {
        upsertedIds.push({
          id,
          provider: notice.provider,
          external_id: notice.external_id,
          solicitation_number: notice.solicitation_number,
          buyer_name: notice.buyer_name,
          duplicate_of_id: prior?.duplicate_of_id ?? null,
        });
      }
    }

    // Soft cross-source: also consider other org rows sharing soft keys (confident only).
    if (upsertedIds.length > 0) {
      const solNumbers = [
        ...new Set(
          upsertedIds
            .map((r) => r.solicitation_number)
            .filter((s): s is string => Boolean(s && s.trim())),
        ),
      ];
      if (solNumbers.length > 0) {
        const { data: peers } = await admin
          .from("public_sources")
          .select(
            "id, provider, external_id, solicitation_number, buyer_name, duplicate_of_id",
          )
          .eq("organization_id", profile.organization_id)
          .in("solicitation_number", solNumbers);
        const peerRows: SoftDedupeRow[] = (peers ?? []).map((row) => ({
          id: row.id,
          provider: row.provider,
          external_id: row.external_id,
          solicitation_number: row.solicitation_number,
          buyer_name: row.buyer_name,
          duplicate_of_id: row.duplicate_of_id,
        }));
        const plans = planSoftCrossSourceDuplicates(peerRows);
        for (const [id, duplicateOf] of plans) {
          if (!duplicateOf) continue;
          const { error } = await admin
            .from("public_sources")
            .update({
              duplicate_of_id: duplicateOf,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id)
            .eq("organization_id", profile.organization_id);
          if (!error) result.softDuplicatesLinked += 1;
        }
      }
    }

    await admin
      .from("opportunity_search_profiles")
      .update({
        last_run_at: new Date().toISOString(),
        last_error: result.errors.length > 0 ? result.errors.join("; ").slice(0, 2000) : null,
        source_health: profileHealth,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync failed";
    result.errors.push(message);
    await admin
      .from("opportunity_search_profiles")
      .update({
        last_run_at: new Date().toISOString(),
        last_error: message.slice(0, 2000),
        source_health: profileHealth,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
  }

  return result;
}

/**
 * Run every enabled profile across all orgs (cron path). Uses service-role client.
 * Bounded: processes at most `maxProfiles` profiles per invocation.
 */
export async function runAllEnabledProfileSyncs(
  admin: AdminClient,
  options?: { maxProfiles?: number },
): Promise<{ profiles: number; results: ProfileSyncResult[] }> {
  const maxProfiles = options?.maxProfiles ?? 50;
  const { data, error } = await admin
    .from("opportunity_search_profiles")
    .select("id, organization_id, name, enabled, criteria, schedule_cron, last_run_at, last_error")
    .eq("enabled", true)
    .order("last_run_at", { ascending: true, nullsFirst: true })
    .limit(maxProfiles);

  if (error) throw new Error(error.message);

  const results: ProfileSyncResult[] = [];
  for (const profile of data ?? []) {
    results.push(
      await runProfileSync(admin, {
        ...profile,
        criteria: (profile.criteria ?? {}) as SearchProfileCriteria,
      }),
    );
  }
  return { profiles: results.length, results };
}

export { planSoftCrossSourceDuplicates, softKeyForNotice } from "./cross-source-dedupe";
