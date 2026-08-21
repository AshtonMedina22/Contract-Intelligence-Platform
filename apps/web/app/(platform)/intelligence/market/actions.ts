"use server";

/**
 * Market Recompete Radar actions — Watch / Start Pursuit for external candidates.
 *
 * Never uses the L&P internal rebid clone (that path is renewal-only).
 * Never invents due dates. Research facts land AI_EXTRACTED only.
 * Automation does not call these — only operator form posts do.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FactVerificationStatus } from "@/lib/supabase/database.types";
import {
  MARKET_START_PURSUIT_NOTE,
  type RecompeteWatchStatus,
} from "@/lib/intelligence/recompete-radar";

const MARKET_PATH = "/intelligence/market";

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

function assertUnverified<T extends { verification_status: FactVerificationStatus }>(row: T): T {
  if (row.verification_status !== "AI_EXTRACTED") {
    throw new Error("Market radar cannot write verified facts. Verify in Data Ops instead.");
  }
  return row;
}

function optionalForm(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v.length > 0 ? v : null;
}

function candidateFromForm(formData: FormData) {
  const candidateKey = String(formData.get("candidate_key") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!candidateKey || !title) throw new Error("Radar candidate key and title are required.");
  return {
    candidateKey,
    title,
    buyerId: optionalForm(formData, "buyer_id"),
    awardId: optionalForm(formData, "award_id"),
    contractId: optionalForm(formData, "contract_id"),
    opportunityId: optionalForm(formData, "opportunity_id"),
    sourceUrl: optionalForm(formData, "source_url"),
    incumbentName: optionalForm(formData, "incumbent_name"),
    buyerName: optionalForm(formData, "buyer_name"),
  };
}

/**
 * Upsert a Market radar watch. Unique on (organization_id, candidate_key) — no daily duplicates.
 * Does not create a pursuit.
 */
export async function watchRecompeteCandidate(formData: FormData) {
  const { supabase, organizationId, userId } = await requireUserOrg();
  const c = candidateFromForm(formData);
  const status: RecompeteWatchStatus = "WATCHING";

  const { error } = await supabase.from("recompete_watches").upsert(
    {
      organization_id: organizationId,
      candidate_key: c.candidateKey,
      status,
      buyer_id: c.buyerId,
      award_id: c.awardId,
      contract_id: c.contractId,
      opportunity_id: c.opportunityId,
      source_url: c.sourceUrl,
      title: c.title,
      created_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,candidate_key" },
  );
  if (error) throw new Error(error.message);

  revalidatePath(MARKET_PATH);
}

/**
 * Dismiss a Market radar candidate watch (operator only).
 */
export async function dismissRecompeteCandidate(formData: FormData) {
  const { supabase, organizationId, userId } = await requireUserOrg();
  const c = candidateFromForm(formData);

  const { error } = await supabase.from("recompete_watches").upsert(
    {
      organization_id: organizationId,
      candidate_key: c.candidateKey,
      status: "DISMISSED" satisfies RecompeteWatchStatus,
      buyer_id: c.buyerId,
      award_id: c.awardId,
      contract_id: c.contractId,
      opportunity_id: c.opportunityId,
      source_url: c.sourceUrl,
      title: c.title,
      created_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,candidate_key" },
  );
  if (error) throw new Error(error.message);

  revalidatePath(MARKET_PATH);
}

/**
 * Start a pursuit from an external Market recompete candidate.
 *
 * Provenance → buyer / award / source. Research fact = AI_EXTRACTED only.
 * Never clones an L&P-held rebid. NEVER invent response_due_on.
 */
export async function startPursuitFromRecompeteCandidate(formData: FormData): Promise<string> {
  const { supabase, organizationId, userId } = await requireUserOrg();
  const c = candidateFromForm(formData);

  // Idempotent: if a watch already started a pursuit for this candidate, reopen it.
  const { data: existingWatch } = await supabase
    .from("recompete_watches")
    .select("id, pursuit_id, status")
    .eq("organization_id", organizationId)
    .eq("candidate_key", c.candidateKey)
    .maybeSingle();
  if (existingWatch?.pursuit_id) {
    return existingWatch.pursuit_id;
  }

  const notes = [
    `Market recompete candidate ${c.candidateKey}.`,
    c.buyerName ? `Buyer: ${c.buyerName}.` : null,
    c.incumbentName ? `Incumbent named on award/outcome: ${c.incumbentName}.` : null,
    c.sourceUrl ? `Source: ${c.sourceUrl}.` : null,
    MARKET_START_PURSUIT_NOTE,
    "No due date invented — response_due_on left null until a solicitation records one.",
    "No pricing copied. Not a rebid of an L&P-held contract.",
  ]
    .filter(Boolean)
    .join(" ");

  const { data: opportunity, error: oppError } = await supabase
    .from("opportunities")
    .insert({
      organization_id: organizationId,
      client_id: c.buyerId,
      title: `Recompete: ${c.title}`,
      stage: "INTAKE",
      go_no_go: "PENDING",
      // Never invent a due date — only a buyer-published solicitation may set one later.
      response_due_on: null,
      source_url: c.sourceUrl,
      notes,
      // Explicitly not a rebid of L&P work.
      rebid_from_contract_id: null,
      rebid_from_opportunity_id: null,
    })
    .select("id")
    .single();
  if (oppError || !opportunity) throw new Error(oppError?.message ?? "Failed to create pursuit.");

  const excerpt = [
    `Market radar candidate ${c.candidateKey}`,
    c.incumbentName ? `incumbent=${c.incumbentName}` : null,
    c.awardId ? `award_id=${c.awardId}` : null,
    c.opportunityId ? `corpus_opportunity_id=${c.opportunityId}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const sourceUrl =
    c.sourceUrl ??
    (c.opportunityId
      ? `/procurement/opportunities/${c.opportunityId}`
      : `/intelligence/market#${encodeURIComponent(c.candidateKey)}`);

  const { error: factError } = await supabase.from("research_facts").insert(
    assertUnverified({
      organization_id: organizationId,
      client_id: c.buyerId,
      opportunity_id: opportunity.id,
      source_url: sourceUrl,
      title: c.title,
      excerpt,
      claim: `External recompete candidate watched from Market radar (${c.candidateKey}).`,
      verification_status: "AI_EXTRACTED",
      verified_by: null,
      verified_at: null,
      provider: null,
      external_id: c.candidateKey,
    }),
  );
  if (factError) throw new Error(factError.message);

  const { error: watchError } = await supabase.from("recompete_watches").upsert(
    {
      organization_id: organizationId,
      candidate_key: c.candidateKey,
      status: "PURSUIT_STARTED" satisfies RecompeteWatchStatus,
      buyer_id: c.buyerId,
      award_id: c.awardId,
      contract_id: c.contractId,
      opportunity_id: c.opportunityId,
      source_url: c.sourceUrl,
      title: c.title,
      pursuit_id: opportunity.id,
      created_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,candidate_key" },
  );
  if (watchError) throw new Error(watchError.message);

  revalidatePath(MARKET_PATH);
  revalidatePath("/procurement/opportunities");
  revalidatePath(`/procurement/opportunities/${opportunity.id}`);
  return opportunity.id;
}

/** Form entry: create pursuit and open workspace. */
export async function startPursuitFromRecompeteAndOpen(formData: FormData) {
  const opportunityId = await startPursuitFromRecompeteCandidate(formData);
  redirect(`/procurement/opportunities/${opportunityId}`);
}
