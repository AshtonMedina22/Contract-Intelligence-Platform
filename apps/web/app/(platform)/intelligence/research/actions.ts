"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FactVerificationStatus } from "@/lib/supabase/database.types";
import { isResearchType, type ResearchType } from "@/lib/ask/research/plan";
import { executeResearchRun } from "@/lib/ask/research/execute-run";
import { syncRunStatusFromFacts } from "@/lib/ask/research/persist-run";
import { generateResearchBrief } from "@/lib/ask/research/synthesize-brief";
import { writeAuditLog } from "@/lib/auth/audit";
import { requirePermission } from "@/lib/auth/permissions";
import { checkRateLimit, RESEARCH_START_RATE } from "@/lib/auth/rate-limit";

const RESEARCH_PATH = "/intelligence/research";

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

function assertResearchRateLimit(userId: string) {
  const limited = checkRateLimit(`research:${userId}`, RESEARCH_START_RATE);
  if (!limited.ok) {
    throw new Error(
      `Too many research requests. Try again in ${limited.retryAfterSec}s. (In-memory limit; not shared across instances.)`,
    );
  }
}

async function loadParties(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string) {
  const [clients, competitors] = await Promise.all([
    supabase.from("clients").select("id, name").eq("organization_id", organizationId).limit(500),
    supabase.from("competitors").select("id, name").eq("organization_id", organizationId).limit(500),
  ]);
  return {
    clients: (clients.data ?? []).map((c) => ({ id: c.id, name: c.name })),
    competitors: (competitors.data ?? []).map((c) => ({ id: c.id, name: c.name })),
  };
}

export async function startResearchRun(formData: FormData): Promise<void> {
  const { supabase, organizationId, userId } = await requireUserOrg();
  await requirePermission(supabase, userId, organizationId, "ask.use");
  assertResearchRateLimit(userId);
  const researchTypeRaw = String(formData.get("research_type") ?? "").trim();
  const query = String(formData.get("query") ?? "").trim();
  const entityName = String(formData.get("entity_name") ?? "").trim() || null;
  const purpose = String(formData.get("purpose") ?? "").trim() || null;

  if (!isResearchType(researchTypeRaw)) throw new Error("Invalid research type.");
  if (!query) throw new Error("Query is required.");

  const parties = await loadParties(supabase, organizationId);
  const result = await executeResearchRun(supabase, {
    organizationId,
    createdBy: userId,
    researchType: researchTypeRaw as ResearchType,
    query,
    purpose,
    entityName,
    clients: parties.clients,
    competitors: parties.competitors,
  });

  revalidatePath(RESEARCH_PATH);
  if (result.status === "FAILED") {
    throw new Error(result.error ?? "Research run failed.");
  }
}

export async function refreshResearchRun(formData: FormData): Promise<void> {
  const { supabase, organizationId, userId } = await requireUserOrg();
  await requirePermission(supabase, userId, organizationId, "ask.use");
  assertResearchRateLimit(userId);
  const runId = String(formData.get("run_id") ?? "").trim();
  if (!runId) throw new Error("run_id required.");

  const { data: run, error } = await supabase
    .from("research_runs")
    .select("id, research_type, query, purpose, client_id, competitor_id, opportunity_id, contract_id")
    .eq("id", runId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !run) throw new Error(error?.message ?? "Run not found.");

  const parties = await loadParties(supabase, organizationId);
  const result = await executeResearchRun(supabase, {
    organizationId,
    createdBy: userId,
    researchType: run.research_type as ResearchType,
    query: run.query,
    purpose: run.purpose,
    clientId: run.client_id,
    competitorId: run.competitor_id,
    opportunityId: run.opportunity_id,
    contractId: run.contract_id,
    clients: parties.clients,
    competitors: parties.competitors,
    refreshRunId: runId,
  });

  revalidatePath(RESEARCH_PATH);
  revalidatePath(`${RESEARCH_PATH}/${runId}`);
  if (result.status === "FAILED") {
    throw new Error(result.error ?? "Refresh failed.");
  }
}

async function auditResearchFact(opts: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  organizationId: string;
  userId: string;
  factId: string;
  action: string;
  fromStatus: FactVerificationStatus | null;
  toStatus: FactVerificationStatus;
  note?: string | null;
}) {
  const { error } = await opts.supabase.from("verification_events").insert({
    organization_id: opts.organizationId,
    research_fact_id: opts.factId,
    extracted_fact_id: null,
    actor_id: opts.userId,
    action: opts.action,
    from_status: opts.fromStatus,
    to_status: opts.toStatus,
    note: opts.note ?? null,
  });
  if (error) throw new Error(error.message);
}

async function loadFactForReview(factId: string) {
  const { supabase, organizationId, userId } = await requireUserOrg();
  const { data: fact, error } = await supabase
    .from("research_facts")
    .select("id, verification_status, research_run_id, title, claim, excerpt")
    .eq("id", factId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !fact) throw new Error(error?.message ?? "Fact not found.");
  return { supabase, organizationId, userId, fact };
}

function revalidateFactPaths(runId: string | null) {
  revalidatePath(RESEARCH_PATH);
  if (runId) revalidatePath(`${RESEARCH_PATH}/${runId}`);
  revalidatePath("/intelligence/clients");
}

/** Require research.verify — sets HUMAN_VERIFIED + verified_by/at. Never silent. */
export async function verifyResearchFact(formData: FormData): Promise<void> {
  const factId = String(formData.get("fact_id") ?? "").trim();
  if (!factId) throw new Error("fact_id required.");
  const { supabase, organizationId, userId, fact } = await loadFactForReview(factId);
  if (!userId) throw new Error("Actor required to verify research facts.");
  await requirePermission(supabase, userId, organizationId, "research.verify");

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("research_facts")
    .update({
      verification_status: "HUMAN_VERIFIED",
      verified_by: userId,
      verified_at: now,
    })
    .eq("id", factId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);

  await auditResearchFact({
    supabase,
    organizationId,
    userId,
    factId,
    action: "research_fact_verify",
    fromStatus: fact.verification_status as FactVerificationStatus,
    toStatus: "HUMAN_VERIFIED",
  });
  await writeAuditLog(supabase, {
    organizationId,
    actorUserId: userId,
    action: "research.verify",
    entityType: "research_fact",
    entityId: factId,
    metadata: { to_status: "HUMAN_VERIFIED" },
  });

  if (fact.research_run_id) {
    await syncRunStatusFromFacts(supabase, {
      organizationId,
      researchRunId: fact.research_run_id,
    });
  }
  revalidateFactPaths(fact.research_run_id);
}

export async function rejectResearchFact(formData: FormData): Promise<void> {
  const factId = String(formData.get("fact_id") ?? "").trim();
  if (!factId) throw new Error("fact_id required.");
  const { supabase, organizationId, userId, fact } = await loadFactForReview(factId);
  if (!userId) throw new Error("Actor required to reject research facts.");
  await requirePermission(supabase, userId, organizationId, "research.verify");

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("research_facts")
    .update({
      verification_status: "REJECTED",
      verified_by: userId,
      verified_at: now,
    })
    .eq("id", factId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);

  await auditResearchFact({
    supabase,
    organizationId,
    userId,
    factId,
    action: "research_fact_reject",
    fromStatus: fact.verification_status as FactVerificationStatus,
    toStatus: "REJECTED",
  });
  await writeAuditLog(supabase, {
    organizationId,
    actorUserId: userId,
    action: "research.reject",
    entityType: "research_fact",
    entityId: factId,
    metadata: { to_status: "REJECTED" },
  });

  if (fact.research_run_id) {
    await syncRunStatusFromFacts(supabase, {
      organizationId,
      researchRunId: fact.research_run_id,
    });
  }
  revalidateFactPaths(fact.research_run_id);
}

export async function editResearchFact(formData: FormData): Promise<void> {
  const factId = String(formData.get("fact_id") ?? "").trim();
  const claim = String(formData.get("claim") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  if (!factId) throw new Error("fact_id required.");
  if (!claim) throw new Error("claim required.");

  const { supabase, organizationId, userId, fact } = await loadFactForReview(factId);
  if (!userId) throw new Error("Actor required to edit research facts.");
  await requirePermission(supabase, userId, organizationId, "research.verify");

  const { error } = await supabase
    .from("research_facts")
    .update({
      claim,
      title: claim,
      excerpt: excerpt || null,
      verification_status: "NEEDS_REVIEW",
      verified_by: null,
      verified_at: null,
    })
    .eq("id", factId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);

  await auditResearchFact({
    supabase,
    organizationId,
    userId,
    factId,
    action: "research_fact_edit",
    fromStatus: fact.verification_status as FactVerificationStatus,
    toStatus: "NEEDS_REVIEW",
    note: "Operator edited claim; returned to NEEDS_REVIEW for re-verification.",
  });
  await writeAuditLog(supabase, {
    organizationId,
    actorUserId: userId,
    action: "research.edit",
    entityType: "research_fact",
    entityId: factId,
    metadata: { to_status: "NEEDS_REVIEW" },
  });

  revalidateFactPaths(fact.research_run_id);
}

export async function markConflictResearchFact(formData: FormData): Promise<void> {
  const factId = String(formData.get("fact_id") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || "Marked CONFLICT by operator.";
  if (!factId) throw new Error("fact_id required.");

  const { supabase, organizationId, userId, fact } = await loadFactForReview(factId);
  if (!userId) throw new Error("Actor required to mark research fact conflict.");
  await requirePermission(supabase, userId, organizationId, "research.verify");

  const { error } = await supabase
    .from("research_facts")
    .update({
      verification_status: "CONFLICT",
      verified_by: null,
      verified_at: null,
    })
    .eq("id", factId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);

  await auditResearchFact({
    supabase,
    organizationId,
    userId,
    factId,
    action: "research_fact_conflict",
    fromStatus: fact.verification_status as FactVerificationStatus,
    toStatus: "CONFLICT",
    note,
  });
  await writeAuditLog(supabase, {
    organizationId,
    actorUserId: userId,
    action: "research.conflict",
    entityType: "research_fact",
    entityId: factId,
    metadata: { to_status: "CONFLICT" },
  });

  revalidateFactPaths(fact.research_run_id);
}

export async function loadResearchBrief(runId: string) {
  const { supabase, organizationId } = await requireUserOrg();
  const { data: facts, error } = await supabase
    .from("research_facts")
    .select("id, title, claim, excerpt, source_url, verification_status, provider")
    .eq("research_run_id", runId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  return generateResearchBrief(runId, facts ?? []);
}
