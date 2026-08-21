"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  contentHashForNotice,
  normalizeManualEntry,
  normalizeTexasEsbdEntry,
  statusForOperatorAction,
  type NormalizedPublicOpportunity,
  type PublicSourceStatus,
} from "@/lib/procurement/providers";
import type { FactVerificationStatus, PublicSourceProvider } from "@/lib/supabase/database.types";

const DISCOVER_PATH = "/procurement/opportunities/discover";
const WATCHLIST_PATH = "/procurement/opportunities/watchlist";

async function requireUserOrg() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required.");
  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership?.organization_id) throw new Error("No organization.");
  return { supabase, organizationId: membership.organization_id, userId: user.id };
}

const PROVIDERS: PublicSourceProvider[] = [
  "sam_gov",
  "fixture",
  "manual",
  "usa_spending",
  "state",
  "local",
  "texas_esbd",
  "socrata",
  "rss",
  "json_feed",
  "html_listing",
];

/**
 * Rebuild a normalized notice from a submitted form. Discover never persists search results,
 * so the row the operator acted on travels with the action instead of living in the database.
 */
function normalizedFromForm(formData: FormData): NormalizedPublicOpportunity {
  const provider = String(formData.get("provider") ?? "").trim() as PublicSourceProvider;
  if (!PROVIDERS.includes(provider)) throw new Error("Unknown public source provider.");
  const external_id = String(formData.get("external_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!external_id || !title) throw new Error("Public notice id and title are required.");

  const optional = (key: string) => String(formData.get(key) ?? "").trim() || null;
  const rawPayload = String(formData.get("raw_payload") ?? "").trim();
  let raw_payload: Record<string, unknown> = {};
  if (rawPayload) {
    try {
      const parsed: unknown = JSON.parse(rawPayload);
      if (parsed && typeof parsed === "object") raw_payload = parsed as Record<string, unknown>;
    } catch {
      raw_payload = {};
    }
  }

  const estimated = optional("estimated_value");
  const estimatedNum = estimated == null ? null : Number.parseFloat(estimated);

  return {
    provider,
    external_id,
    title,
    source_url: optional("source_url"),
    buyer_name: optional("buyer_name"),
    solicitation_number: optional("solicitation_number"),
    procurement_type: optional("procurement_type"),
    posted_on: optional("posted_on"),
    due_on: optional("due_on"),
    naics: optional("naics"),
    psc: optional("psc"),
    set_aside: optional("set_aside"),
    geography: optional("geography"),
    estimated_value: estimatedNum != null && Number.isFinite(estimatedNum) ? estimatedNum : null,
    raw_payload,
  };
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Discovery can only ever produce unverified evidence. Human verification happens in the
 * Data Ops workbench against an ingested document, never as a side effect of a Discover click.
 */
function assertUnverified<T extends { verification_status: FactVerificationStatus }>(row: T): T {
  if (row.verification_status !== "AI_EXTRACTED") {
    throw new Error("Public discovery cannot write verified facts. Verify in Data Ops instead.");
  }
  return row;
}

type UpsertPatch = {
  watchlisted_at?: string | null;
  dismissed_at?: string | null;
  status: PublicSourceStatus;
};

/** Upsert the public record and return its id. Public facts stay public — nothing is promoted. */
async function upsertPublicSource(
  supabase: SupabaseServerClient,
  organizationId: string,
  userId: string,
  notice: NormalizedPublicOpportunity,
  patch: UpsertPatch,
): Promise<string> {
  const { data, error } = await supabase
    .from("public_sources")
    .upsert(
      {
        organization_id: organizationId,
        provider: notice.provider,
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
        content_hash: contentHashForNotice(notice),
        status: patch.status,
        capability:
          notice.provider === "texas_esbd" || notice.provider === "html_listing"
            ? "MANUAL_IMPORT"
            : notice.provider === "manual" ||
                notice.provider === "state" ||
                notice.provider === "local"
              ? "MANUAL_IMPORT"
              : notice.provider === "socrata" ||
                  notice.provider === "rss" ||
                  notice.provider === "json_feed" ||
                  notice.provider === "sam_gov"
                ? "AUTOMATED"
                : null,
        created_by: userId,
        updated_at: new Date().toISOString(),
        watchlisted_at: patch.watchlisted_at,
        dismissed_at: patch.dismissed_at,
      },
      { onConflict: "organization_id,provider,external_id" },
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

/** Persist a discovered notice onto the watchlist. This is the operator's explicit opt-in. */
export async function watchOpportunity(formData: FormData) {
  const { supabase, organizationId, userId } = await requireUserOrg();
  const notice = normalizedFromForm(formData);
  await upsertPublicSource(supabase, organizationId, userId, notice, {
    watchlisted_at: new Date().toISOString(),
    dismissed_at: null,
    status: statusForOperatorAction("watch"),
  });
  revalidatePath(DISCOVER_PATH);
  revalidatePath(WATCHLIST_PATH);
}

/** Record that the operator does not want to see this notice again. */
export async function dismissOpportunity(formData: FormData) {
  const { supabase, organizationId, userId } = await requireUserOrg();
  const existingId = String(formData.get("public_source_id") ?? "").trim();

  if (existingId) {
    const { error } = await supabase
      .from("public_sources")
      .update({
        dismissed_at: new Date().toISOString(),
        watchlisted_at: null,
        status: statusForOperatorAction("dismiss"),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingId);
    if (error) throw new Error(error.message);
  } else {
    const notice = normalizedFromForm(formData);
    await upsertPublicSource(supabase, organizationId, userId, notice, {
      dismissed_at: new Date().toISOString(),
      watchlisted_at: null,
      status: statusForOperatorAction("dismiss"),
    });
  }

  revalidatePath(DISCOVER_PATH);
  revalidatePath(WATCHLIST_PATH);
}

/** Move a watched notice back into Discover results. */
export async function undismissOpportunity(formData: FormData) {
  const { supabase } = await requireUserOrg();
  const id = String(formData.get("public_source_id") ?? "").trim();
  if (!id) throw new Error("Public source required.");
  const { error } = await supabase
    .from("public_sources")
    .update({
      dismissed_at: null,
      watchlisted_at: new Date().toISOString(),
      status: statusForOperatorAction("restore"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(DISCOVER_PATH);
  revalidatePath(WATCHLIST_PATH);
}

/**
 * Match an existing buyer by name only. A public notice names a buyer; it does not tell us
 * anything about them, so we link when the buyer already exists and otherwise leave the
 * pursuit unlinked rather than creating an empty buyer record.
 */
async function matchExistingClient(
  supabase: SupabaseServerClient,
  organizationId: string,
  buyerName: string | null,
): Promise<string | null> {
  const name = buyerName?.trim();
  if (!name) return null;
  const { data } = await supabase
    .from("clients")
    .select("id, name")
    .eq("organization_id", organizationId)
    .ilike("name", name)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Create a pursuit from a public notice.
 *
 * The pursuit starts at INTAKE with go/no-go PENDING because a public listing is not a bid
 * decision. Provenance (provider, external id, url, public_source_id) is recorded, and the
 * notice is written to `research_facts` as AI_EXTRACTED — public records are never
 * HUMAN_VERIFIED without a human verifying them in the workbench.
 */
export async function startPursuitFromPublicSource(formData: FormData): Promise<string> {
  const { supabase, organizationId, userId } = await requireUserOrg();

  const existingId = String(formData.get("public_source_id") ?? "").trim();
  let publicSourceId: string;
  let notice: NormalizedPublicOpportunity;

  if (existingId) {
    const { data: row, error } = await supabase
      .from("public_sources")
      .select("*")
      .eq("id", existingId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Public source not found.");
    publicSourceId = row.id;
    notice = {
      provider: row.provider,
      external_id: row.external_id,
      title: row.title,
      source_url: row.source_url,
      buyer_name: row.buyer_name,
      solicitation_number: row.solicitation_number,
      procurement_type: row.procurement_type,
      posted_on: row.posted_on,
      due_on: row.due_on,
      naics: row.naics,
      psc: row.psc,
      set_aside: row.set_aside,
      geography: row.geography,
      estimated_value: row.estimated_value,
      raw_payload: row.raw_payload ?? {},
    };
    const { error: statusError } = await supabase
      .from("public_sources")
      .update({
        status: statusForOperatorAction("start_pursuit"),
        watchlisted_at: row.watchlisted_at ?? new Date().toISOString(),
        dismissed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", publicSourceId);
    if (statusError) throw new Error(statusError.message);
  } else {
    notice = normalizedFromForm(formData);
    publicSourceId = await upsertPublicSource(supabase, organizationId, userId, notice, {
      watchlisted_at: new Date().toISOString(),
      dismissed_at: null,
      status: statusForOperatorAction("start_pursuit"),
    });
  }

  // Provenance uniqueness is enforced in Postgres; reuse the existing pursuit if there is one.
  const { data: existingPursuit } = await supabase
    .from("opportunities")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("external_provider", notice.provider)
    .eq("external_source_id", notice.external_id)
    .limit(1)
    .maybeSingle();
  if (existingPursuit?.id) {
    revalidatePath(WATCHLIST_PATH);
    return existingPursuit.id;
  }

  const clientId = await matchExistingClient(supabase, organizationId, notice.buyer_name);

  const { data: opportunity, error: oppError } = await supabase
    .from("opportunities")
    .insert({
      organization_id: organizationId,
      client_id: clientId,
      title: notice.title,
      stage: "INTAKE",
      go_no_go: "PENDING",
      response_due_on: notice.due_on,
      site_location: notice.geography,
      external_provider: notice.provider,
      external_source_id: notice.external_id,
      source_url: notice.source_url,
      public_source_id: publicSourceId,
      notes: publicNoticeNote(notice),
    })
    .select("id")
    .single();
  if (oppError) throw new Error(oppError.message);

  // Public notice metadata is external evidence, not verified truth.
  if (notice.source_url) {
    const { error: factError } = await supabase.from("research_facts").insert(
      assertUnverified({
        organization_id: organizationId,
        client_id: clientId,
        opportunity_id: opportunity.id,
        source_url: notice.source_url,
        title: notice.title,
        excerpt: publicNoticeNote(notice),
        published_on: notice.posted_on,
        verification_status: "AI_EXTRACTED",
        verified_by: null,
        verified_at: null,
        provider: notice.provider,
        external_id: notice.external_id,
      }),
    );
    if (factError) throw new Error(factError.message);
  }

  revalidatePath(DISCOVER_PATH);
  revalidatePath(WATCHLIST_PATH);
  revalidatePath("/procurement/opportunities");
  revalidatePath(`/procurement/opportunities/${opportunity.id}`);
  return opportunity.id;
}

/** Form entry point: create the pursuit and open its workspace. */
export async function startPursuitAndOpen(formData: FormData) {
  const opportunityId = await startPursuitFromPublicSource(formData);
  redirect(`/procurement/opportunities/${opportunityId}`);
}

/**
 * Paste a public notice URL/title into Discover. Normalizes via normalizeManualEntry, then
 * watches or starts a pursuit — never invents fields the operator did not supply.
 */
export async function submitManualPublicEntry(formData: FormData) {
  const { supabase, organizationId, userId } = await requireUserOrg();
  const intent = String(formData.get("intent") ?? "watch").trim();
  const kindRaw = String(formData.get("kind") ?? "manual").trim();
  const kind =
    kindRaw === "local" || kindRaw === "state" || kindRaw === "manual" ? kindRaw : "manual";
  const notice = normalizeManualEntry({
    title: String(formData.get("title") ?? ""),
    source_url: String(formData.get("source_url") ?? "") || null,
    buyer_name: String(formData.get("buyer_name") ?? "") || null,
    solicitation_number: String(formData.get("solicitation_number") ?? "") || null,
    due_on: String(formData.get("due_on") ?? "") || null,
    geography: String(formData.get("geography") ?? "") || null,
    naics: String(formData.get("naics") ?? "") || null,
    kind,
  });
  if (!notice) throw new Error("Title is required for a manual public notice.");

  if (intent === "start") {
    const payload = new FormData();
    payload.set("provider", notice.provider);
    payload.set("external_id", notice.external_id);
    payload.set("title", notice.title);
    payload.set("source_url", notice.source_url ?? "");
    payload.set("buyer_name", notice.buyer_name ?? "");
    payload.set("solicitation_number", notice.solicitation_number ?? "");
    payload.set("procurement_type", "");
    payload.set("posted_on", "");
    payload.set("due_on", notice.due_on ?? "");
    payload.set("naics", notice.naics ?? "");
    payload.set("psc", "");
    payload.set("set_aside", "");
    payload.set("geography", notice.geography ?? "");
    payload.set("estimated_value", "");
    payload.set("raw_payload", JSON.stringify(notice.raw_payload));
    const opportunityId = await startPursuitFromPublicSource(payload);
    redirect(`/procurement/opportunities/${opportunityId}`);
  }

  await upsertPublicSource(supabase, organizationId, userId, notice, {
    watchlisted_at: new Date().toISOString(),
    dismissed_at: null,
    status: statusForOperatorAction("watch"),
  });
  revalidatePath(DISCOVER_PATH);
  revalidatePath(WATCHLIST_PATH);
  redirect(WATCHLIST_PATH);
}

/**
 * Texas ESBD MANUAL_IMPORT paste. LINK_ONLY portal is separate — this persists only what
 * the operator pasted. Never scrapes ESBD; never auto-ingests solicitation docs.
 */
export async function submitTexasEsbdEntry(formData: FormData) {
  const { supabase, organizationId, userId } = await requireUserOrg();
  const intent = String(formData.get("intent") ?? "watch").trim();
  const notice = normalizeTexasEsbdEntry({
    title: String(formData.get("title") ?? ""),
    source_url: String(formData.get("source_url") ?? "") || null,
    buyer_name: String(formData.get("buyer_name") ?? "") || null,
    solicitation_number: String(formData.get("solicitation_number") ?? "") || null,
    due_on: String(formData.get("due_on") ?? "") || null,
    geography: String(formData.get("geography") ?? "") || null,
    naics: String(formData.get("naics") ?? "") || null,
  });
  if (!notice) throw new Error("Title is required for a Texas ESBD notice.");

  if (intent === "start") {
    const payload = new FormData();
    payload.set("provider", notice.provider);
    payload.set("external_id", notice.external_id);
    payload.set("title", notice.title);
    payload.set("source_url", notice.source_url ?? "");
    payload.set("buyer_name", notice.buyer_name ?? "");
    payload.set("solicitation_number", notice.solicitation_number ?? "");
    payload.set("procurement_type", notice.procurement_type ?? "");
    payload.set("posted_on", "");
    payload.set("due_on", notice.due_on ?? "");
    payload.set("naics", notice.naics ?? "");
    payload.set("psc", "");
    payload.set("set_aside", "");
    payload.set("geography", notice.geography ?? "");
    payload.set("estimated_value", "");
    payload.set("raw_payload", JSON.stringify(notice.raw_payload));
    const opportunityId = await startPursuitFromPublicSource(payload);
    redirect(`/procurement/opportunities/${opportunityId}`);
  }

  await upsertPublicSource(supabase, organizationId, userId, notice, {
    watchlisted_at: new Date().toISOString(),
    dismissed_at: null,
    status: statusForOperatorAction("watch"),
  });
  revalidatePath(DISCOVER_PATH);
  revalidatePath(WATCHLIST_PATH);
  redirect(WATCHLIST_PATH);
}

/** Create or update an org-scoped search profile (Discover settings). */
export async function saveSearchProfile(formData: FormData) {
  const { supabase, organizationId, userId } = await requireUserOrg();
  const id = String(formData.get("profile_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Profile name is required.");

  const enabled = String(formData.get("enabled") ?? "") === "1";
  const criteria = {
    keywords: String(formData.get("keywords") ?? "").trim() || null,
    buyer: String(formData.get("buyer") ?? "").trim() || null,
    naics: String(formData.get("naics") ?? "").trim() || null,
    set_aside: String(formData.get("set_aside") ?? "").trim() || null,
    state: String(formData.get("state") ?? "").trim() || null,
    dueWithinDays: (() => {
      const n = Number.parseInt(String(formData.get("dueWithinDays") ?? ""), 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    })(),
    limit: (() => {
      const n = Number.parseInt(String(formData.get("limit") ?? ""), 10);
      return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 25;
    })(),
  };
  const schedule_cron = String(formData.get("schedule_cron") ?? "").trim() || null;

  if (id) {
    const { error } = await supabase
      .from("opportunity_search_profiles")
      .update({
        name,
        enabled,
        criteria,
        schedule_cron,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("opportunity_search_profiles").insert({
      organization_id: organizationId,
      name,
      enabled,
      criteria,
      schedule_cron,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath(DISCOVER_PATH);
}

export async function deleteSearchProfile(formData: FormData) {
  const { supabase, organizationId } = await requireUserOrg();
  const id = String(formData.get("profile_id") ?? "").trim();
  if (!id) throw new Error("Profile required.");
  const { error } = await supabase
    .from("opportunity_search_profiles")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  revalidatePath(DISCOVER_PATH);
}

export async function toggleSearchProfile(formData: FormData) {
  const { supabase, organizationId } = await requireUserOrg();
  const id = String(formData.get("profile_id") ?? "").trim();
  const enabled = String(formData.get("enabled") ?? "") === "1";
  if (!id) throw new Error("Profile required.");
  const { error } = await supabase
    .from("opportunity_search_profiles")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  revalidatePath(DISCOVER_PATH);
}

/** Verbatim provider fields only — no interpretation, scoring, or fit assessment. */
function publicNoticeNote(notice: NormalizedPublicOpportunity): string {
  const lines = [
    `Started from public notice (${notice.provider}: ${notice.external_id}).`,
    notice.buyer_name ? `Buyer as listed: ${notice.buyer_name}` : null,
    notice.solicitation_number ? `Solicitation: ${notice.solicitation_number}` : null,
    notice.procurement_type ? `Notice type: ${notice.procurement_type}` : null,
    notice.naics ? `NAICS: ${notice.naics}` : null,
    notice.psc ? `PSC: ${notice.psc}` : null,
    notice.set_aside ? `Set-aside: ${notice.set_aside}` : null,
    notice.due_on ? `Response due as listed: ${notice.due_on}` : null,
    notice.source_url ? `Source: ${notice.source_url}` : null,
    "Public record only — ingest and verify the solicitation before relying on any of these values.",
  ];
  return lines.filter(Boolean).join("\n");
}
