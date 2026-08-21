"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
  return { supabase, organizationId: membership.organization_id };
}

/**
 * Start a rebid pursuit from an expiring contract.
 *
 * This clones *context*, never commercial terms: the buyer, the service type and a provenance note
 * that names the contract and the prior pursuit. No pricing line, no rate and no award amount is
 * copied forward, because prior rates were priced against a prior solicitation, a prior wage
 * determination and a prior scope. The new pursuit starts in INTAKE with go/no-go PENDING so the
 * decision to bid is still a human one.
 *
 * The lineage columns `rebid_from_contract_id` and `rebid_from_opportunity_id` are what make the
 * rebid discoverable from the contract's Renewal tab.
 */
export async function cloneRebidFromContract(contractId: string) {
  const { supabase, organizationId } = await requireUserOrg();

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("id, title, opportunity_id, client_id, verified_end_on")
    .eq("id", contractId)
    .maybeSingle();
  if (contractError || !contract) throw new Error(contractError?.message ?? "Contract not found.");

  let priorTitle = contract.title;
  let serviceType: string | null = null;
  if (contract.opportunity_id) {
    const { data: prior } = await supabase
      .from("opportunities")
      .select("title, service_type")
      .eq("id", contract.opportunity_id)
      .maybeSingle();
    if (prior?.title) priorTitle = prior.title;
    serviceType = prior?.service_type ?? null;
  }

  const endNote = contract.verified_end_on
    ? `Contract ends ${contract.verified_end_on} (verified).`
    : "Contract has no verified end date on file.";
  const notes = [
    `Rebid from contract ${contract.title}.`,
    endNote,
    contract.opportunity_id ? `Prior pursuit ${contract.opportunity_id}.` : "",
    "No pricing copied: prior rates were priced against a prior solicitation and must be re-verified against the new one.",
  ]
    .filter(Boolean)
    .join(" ");

  const { data: created, error: createError } = await supabase
    .from("opportunities")
    .insert({
      organization_id: organizationId,
      client_id: contract.client_id,
      title: `Rebid: ${priorTitle}`,
      stage: "INTAKE",
      go_no_go: "PENDING",
      service_type: serviceType,
      notes,
      rebid_from_contract_id: contract.id,
      rebid_from_opportunity_id: contract.opportunity_id,
    })
    .select("id")
    .single();

  if (createError || !created) throw new Error(createError?.message ?? "Failed to create rebid workspace.");

  revalidatePath("/proposals");
  revalidatePath("/procurement/opportunities");
  revalidatePath("/contracts");
  revalidatePath("/contracts/renewals");
  revalidatePath(`/contracts/${contract.id}/renewal`);
  redirect(`/procurement/opportunities/${created.id}`);
}
