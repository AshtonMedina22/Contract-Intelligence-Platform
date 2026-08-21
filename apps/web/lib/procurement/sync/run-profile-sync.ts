import {
  contentHashForNotice,
  publicSourceDedupeKey,
  statusAfterSync,
  type NormalizedPublicOpportunity,
  type PublicOpportunityQuery,
  type PublicSourceStatus,
} from "@/lib/procurement/providers";
import { getPublicProcurementProviders } from "@/lib/procurement/providers";
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
};

/**
 * Plan the upsert for one provider hit against an existing row map.
 * Never invents notices — caller must only pass provider-returned rows.
 */
export function planSyncUpsert(
  notice: NormalizedPublicOpportunity,
  existingByKey: Map<
    string,
    { status: PublicSourceStatus; content_hash: string | null }
  >,
  today?: string,
): SyncUpsertPlan {
  const key = publicSourceDedupeKey(notice.provider, notice.external_id);
  const existing = existingByKey.get(key) ?? null;
  return {
    notice,
    content_hash: contentHashForNotice(notice),
    status: statusAfterSync({
      existing: existing?.status ?? null,
      due_on: notice.due_on,
      today,
    }),
    is_new: existing == null,
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
  errors: string[];
};

type AdminClient = SupabaseClient;

async function loadExistingKeys(
  admin: AdminClient,
  organizationId: string,
  notices: NormalizedPublicOpportunity[],
): Promise<Map<string, { status: PublicSourceStatus; content_hash: string | null; id: string }>> {
  const map = new Map<
    string,
    { status: PublicSourceStatus; content_hash: string | null; id: string }
  >();
  if (notices.length === 0) return map;

  const providers = [...new Set(notices.map((n) => n.provider))];
  const externalIds = [...new Set(notices.map((n) => n.external_id))];

  const { data, error } = await admin
    .from("public_sources")
    .select("id, provider, external_id, status, content_hash")
    .eq("organization_id", organizationId)
    .in("provider", providers)
    .in("external_id", externalIds);

  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    map.set(publicSourceDedupeKey(row.provider, row.external_id), {
      id: row.id,
      status: row.status as PublicSourceStatus,
      content_hash: row.content_hash,
    });
  }
  return map;
}

async function upsertPlanned(
  admin: AdminClient,
  organizationId: string,
  plan: SyncUpsertPlan,
): Promise<void> {
  const notice = plan.notice;
  // Intentionally omit watchlisted_at / dismissed_at / created_by so sync cannot invent
  // operator signals or clear them on conflict update.
  const { error } = await admin.from("public_sources").upsert(
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
      retrieved_at: new Date().toISOString(),
      content_hash: plan.content_hash,
      status: plan.status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,provider,external_id" },
  );
  if (error) throw new Error(error.message);
}

/**
 * Sync may only persist live provider hits. Fixture / sample adapters are for Discover UI
 * only (P4: show without persisting on view). Never upsert fixture rows into public_sources.
 */
export function isLiveSyncProvider(provider: {
  id: string;
  mode: string;
}): boolean {
  if (provider.mode === "fixture") return false;
  if (provider.id === "fixture") return false;
  return provider.mode === "live";
}

/**
 * Run one enabled search profile: provider.search → dedupe → upsert public_sources.
 * Never invents rows. Fixture-mode providers are skipped (fail closed) — sync persists
 * live provider results only.
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
    errors: [],
  };

  const query = criteriaToQuery(profile.criteria);
  const providers = getPublicProcurementProviders();
  const collected: NormalizedPublicOpportunity[] = [];

  for (const provider of providers) {
    if (!isLiveSyncProvider(provider)) {
      result.errors.push(
        `${provider.id}: SKIP — fixture/sample mode; sync persists live provider hits only (Discover may still show samples without writing on view)`,
      );
      continue;
    }
    try {
      const search = await provider.search(query);
      if (search.mode === "fixture" || search.provider === "fixture") {
        result.errors.push(
          `${provider.id}: SKIP — search returned fixture mode; refusing to persist sample notices`,
        );
        continue;
      }
      if (search.error) result.errors.push(`${provider.id}: ${search.error}`);
      // Defense in depth: never collect fixture-labeled notices even from a live adapter.
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

  try {
    const existing = await loadExistingKeys(admin, profile.organization_id, unique);
    for (const notice of unique) {
      const plan = planSyncUpsert(notice, existing);
      await upsertPlanned(admin, profile.organization_id, plan);
      result.upserted += 1;
      existing.set(publicSourceDedupeKey(notice.provider, notice.external_id), {
        id: existing.get(publicSourceDedupeKey(notice.provider, notice.external_id))?.id ?? "",
        status: plan.status,
        content_hash: plan.content_hash,
      });
    }

    await admin
      .from("opportunity_search_profiles")
      .update({
        last_run_at: new Date().toISOString(),
        last_error: result.errors.length > 0 ? result.errors.join("; ").slice(0, 2000) : null,
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
