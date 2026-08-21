/**
 * F4 research run persistence.
 * Facts are AI_EXTRACTED only. Fixtures refused. Historical sources/facts never deleted on refresh.
 */

import { createHash } from "node:crypto";
import type { FactVerificationStatus } from "@/lib/supabase/database.types";
import type { ResearchPlan, ResearchType } from "@/lib/ask/research/plan";

export type ResearchRunStatus =
  | "QUEUED"
  | "RESEARCHING"
  | "REVIEW_READY"
  | "VERIFIED"
  | "REJECTED"
  | "FAILED";

export type ResearchSourceInput = {
  url: string;
  title?: string | null;
  publisher?: string | null;
  domain?: string | null;
  published_on?: string | null;
  source_type?: string | null;
  excerpt?: string | null;
  content_hash?: string | null;
  provider: string;
  external_id?: string | null;
  retrieved_at?: string | null;
};

export type ResearchFactInput = {
  source_url: string;
  title?: string | null;
  claim?: string | null;
  excerpt?: string | null;
  published_on?: string | null;
  confidence?: number | null;
  provider?: string | null;
  external_id?: string | null;
  client_id?: string | null;
  competitor_id?: string | null;
  opportunity_id?: string | null;
  research_source_id?: string | null;
  retrieved_at?: string | null;
};

/** Loose Supabase-compatible client — keeps persist helpers testable without full Database types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ResearchDb = { from: (table: string) => any };

export function hashUrl(url: string): string {
  return createHash("sha256").update(url.trim()).digest("hex");
}

export function domainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function assertUnverifiedResearchFact<T extends { verification_status: FactVerificationStatus }>(
  row: T,
): T {
  if (row.verification_status !== "AI_EXTRACTED") {
    throw new Error("Public research cannot write verified facts. Verify each fact with an actor.");
  }
  return row;
}

export function refuseFixtureProvider(provider: string | null | undefined, externalId?: string | null): void {
  const p = (provider ?? "").trim().toLowerCase();
  const ext = (externalId ?? "").trim().toUpperCase();
  if (p === "fixture" || p.startsWith("fixture") || ext.startsWith("FIXTURE-")) {
    throw new Error("Refusing to persist FIXTURE-* / fixture providers into research_facts.");
  }
}

export function buildAiExtractedFactRow(opts: {
  organizationId: string;
  researchRunId: string;
  fact: ResearchFactInput;
}): Record<string, unknown> {
  refuseFixtureProvider(opts.fact.provider, opts.fact.external_id);
  const title = (opts.fact.title ?? opts.fact.claim ?? "").trim() || null;
  const claim = (opts.fact.claim ?? opts.fact.title ?? "").trim() || null;
  const url = opts.fact.source_url.trim();
  if (!url) throw new Error("source_url is required.");

  return assertUnverifiedResearchFact({
    organization_id: opts.organizationId,
    research_run_id: opts.researchRunId,
    research_source_id: opts.fact.research_source_id ?? null,
    client_id: opts.fact.client_id ?? null,
    competitor_id: opts.fact.competitor_id ?? null,
    opportunity_id: opts.fact.opportunity_id ?? null,
    source_url: url,
    title,
    claim,
    excerpt: opts.fact.excerpt ?? null,
    published_on: opts.fact.published_on ?? null,
    confidence: opts.fact.confidence ?? null,
    retrieved_at: opts.fact.retrieved_at ?? new Date().toISOString(),
    verification_status: "AI_EXTRACTED" as const,
    provider: opts.fact.provider ?? null,
    external_id: opts.fact.external_id ?? null,
    verified_by: null,
    verified_at: null,
  });
}

export async function createResearchRun(
  client: ResearchDb,
  opts: {
    organizationId: string;
    createdBy: string;
    researchType: ResearchType;
    query: string;
    purpose?: string | null;
    plan: ResearchPlan;
    clientId?: string | null;
    competitorId?: string | null;
    opportunityId?: string | null;
    contractId?: string | null;
  },
): Promise<{ id: string; status: ResearchRunStatus }> {
  const { data, error } = await client
    .from("research_runs")
    .insert({
      organization_id: opts.organizationId,
      research_type: opts.researchType,
      status: "QUEUED",
      query: opts.query.trim(),
      purpose: opts.purpose ?? null,
      plan: {
        subquestions: opts.plan.subquestions,
        seed_query: opts.plan.seed_query,
        entity_name: opts.plan.entity_name,
        research_type: opts.plan.research_type,
      },
      client_id: opts.clientId ?? null,
      competitor_id: opts.competitorId ?? null,
      opportunity_id: opts.opportunityId ?? null,
      contract_id: opts.contractId ?? null,
      created_by: opts.createdBy,
    })
    .select("id, status")
    .single();

  if (error || !data?.id) throw new Error(error?.message ?? "Failed to create research run.");

  const { error: upErr } = await client
    .from("research_runs")
    .update({ status: "RESEARCHING" })
    .eq("id", data.id)
    .eq("organization_id", opts.organizationId);
  if (upErr) throw new Error(upErr.message);

  return { id: String(data.id), status: "RESEARCHING" };
}

/**
 * Record sources for a run. Dedupes by (research_run_id, url). Never deletes historical rows.
 */
export async function recordSources(
  client: ResearchDb,
  opts: {
    organizationId: string;
    researchRunId: string;
    sources: ResearchSourceInput[];
  },
): Promise<Map<string, string>> {
  const out = new Map<string, string>();

  for (const src of opts.sources) {
    refuseFixtureProvider(src.provider, src.external_id);
    const url = src.url.trim();
    if (!url) continue;

    const { data: found } = await client
      .from("research_sources")
      .select("id")
      .eq("research_run_id", opts.researchRunId)
      .eq("organization_id", opts.organizationId)
      .eq("url", url)
      .maybeSingle();

    if (found?.id) {
      out.set(url, String(found.id));
      continue;
    }

    const row = {
      organization_id: opts.organizationId,
      research_run_id: opts.researchRunId,
      url,
      url_hash: hashUrl(url),
      title: src.title ?? null,
      publisher: src.publisher ?? null,
      domain: src.domain ?? domainFromUrl(url),
      retrieved_at: src.retrieved_at ?? new Date().toISOString(),
      published_on: src.published_on ?? null,
      source_type: src.source_type ?? "web",
      excerpt: src.excerpt ?? null,
      content_hash: src.content_hash ?? null,
      provider: src.provider,
      external_id: src.external_id ?? null,
    };

    const { data: inserted, error } = await client.from("research_sources").insert(row).select("id").single();
    if (error) {
      const { data: again } = await client
        .from("research_sources")
        .select("id")
        .eq("research_run_id", opts.researchRunId)
        .eq("organization_id", opts.organizationId)
        .eq("url", url)
        .maybeSingle();
      if (again?.id) {
        out.set(url, String(again.id));
        continue;
      }
      throw new Error(error.message);
    }
    if (inserted?.id) out.set(url, String(inserted.id));
  }

  return out;
}

export async function insertAiExtractedFacts(
  client: ResearchDb,
  opts: {
    organizationId: string;
    researchRunId: string;
    facts: ResearchFactInput[];
  },
): Promise<string[]> {
  const ids: string[] = [];
  for (const fact of opts.facts) {
    const row = buildAiExtractedFactRow({
      organizationId: opts.organizationId,
      researchRunId: opts.researchRunId,
      fact,
    });
    const { data, error } = await client.from("research_facts").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    if (data?.id) ids.push(String(data.id));
  }
  return ids;
}

export async function completeRun(
  client: ResearchDb,
  opts: {
    organizationId: string;
    researchRunId: string;
    status: "REVIEW_READY" | "FAILED";
    lastError?: string | null;
  },
): Promise<void> {
  const { error } = await client
    .from("research_runs")
    .update({
      status: opts.status,
      completed_at: new Date().toISOString(),
      last_error: opts.lastError ?? null,
    })
    .eq("id", opts.researchRunId)
    .eq("organization_id", opts.organizationId);
  if (error) throw new Error(error.message);
}

/** Mark RESEARCHING for append-only refresh. Never deletes prior sources/facts. */
export async function beginRefreshRun(
  client: ResearchDb,
  opts: { organizationId: string; researchRunId: string },
): Promise<void> {
  const { error } = await client
    .from("research_runs")
    .update({
      status: "RESEARCHING",
      completed_at: null,
      last_error: null,
    })
    .eq("id", opts.researchRunId)
    .eq("organization_id", opts.organizationId);
  if (error) throw new Error(error.message);
}

/**
 * When every fact is HUMAN_VERIFIED or REJECTED:
 * any HUMAN_VERIFIED → VERIFIED; all REJECTED → REJECTED; else stay REVIEW_READY.
 */
export function deriveRunStatusFromFacts(
  statuses: FactVerificationStatus[],
): Exclude<ResearchRunStatus, "QUEUED" | "RESEARCHING" | "FAILED"> {
  if (statuses.length === 0) return "REVIEW_READY";
  const open = statuses.some(
    (s) => s === "AI_EXTRACTED" || s === "NEEDS_REVIEW" || s === "CONFLICT",
  );
  if (open) return "REVIEW_READY";
  if (statuses.some((s) => s === "HUMAN_VERIFIED")) return "VERIFIED";
  return "REJECTED";
}

export async function syncRunStatusFromFacts(
  client: ResearchDb,
  opts: { organizationId: string; researchRunId: string },
): Promise<ReturnType<typeof deriveRunStatusFromFacts>> {
  const { data, error } = await client
    .from("research_facts")
    .select("verification_status")
    .eq("research_run_id", opts.researchRunId)
    .eq("organization_id", opts.organizationId);

  if (error) throw new Error(error.message);
  const next = deriveRunStatusFromFacts(
    ((data ?? []) as { verification_status: FactVerificationStatus }[]).map((r) => r.verification_status),
  );
  if (next === "VERIFIED" || next === "REJECTED") {
    const { error: upErr } = await client
      .from("research_runs")
      .update({
        status: next,
        completed_at: new Date().toISOString(),
      })
      .eq("id", opts.researchRunId)
      .eq("organization_id", opts.organizationId);
    if (upErr) throw new Error(upErr.message);
  }
  return next;
}
