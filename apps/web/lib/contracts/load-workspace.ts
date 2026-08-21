import { createClient } from "@/lib/supabase/server";
import { buildContractPortfolio, type ContractPortfolio } from "@/lib/contracts/portfolio-model";

// Status derivation lives in the pure model so the acceptance suite can exercise the shipped code.
export { deriveContractStatus } from "@/lib/contracts/portfolio-model";
export type { ContractStatus } from "@/lib/contracts/portfolio-model";

/**
 * One read for the whole portfolio view. Every table here already existed; nothing is created and
 * no amount is derived in SQL. These loaders never invent a date or a value — they hand the pure
 * model exactly what is on file and the model decides what can be stated and what stays absent.
 */
export async function loadContractPortfolio(): Promise<ContractPortfolio> {
  const supabase = await createClient();
  const [contracts, alerts, options, notices, purchaseOrders, buyers] = await Promise.all([
    supabase
      .from("contracts")
      .select(
        "id, client_id, opportunity_id, title, contract_number, start_on, verified_end_on, source_fact_id, source_document_id",
      )
      .limit(500),
    supabase
      .from("contract_alerts")
      .select("contract_id, bucket, days_until, verified_end_on, computed_on")
      .limit(1000),
    supabase.from("contract_options").select("id, contract_id, label, exercise_by, source_fact_id").limit(1000),
    supabase
      .from("renewals")
      .select("id, contract_id, notice, notice_due_on, option_year, escalation_index, escalation_pct, source_fact_id")
      .limit(1000),
    supabase
      .from("purchase_orders")
      .select("id, contract_id, po_number, issued_on, total_amount, source_fact_id, source_document_id")
      .limit(1000),
    supabase.from("clients").select("id, name").limit(1000),
  ]);

  const opportunityIds = (contracts.data ?? [])
    .map((c) => c.opportunity_id)
    .filter((id): id is string => id != null);
  const awards =
    opportunityIds.length > 0
      ? await supabase
          .from("awards")
          .select("id, opportunity_id, amount_nte, awarded_on, notice, winner_name, source_fact_id, source_document_id")
          .in("opportunity_id", opportunityIds)
      : { data: [] };

  return buildContractPortfolio({
    contracts: contracts.data ?? [],
    alerts: alerts.data ?? [],
    options: options.data ?? [],
    renewalNotices: notices.data ?? [],
    purchaseOrders: purchaseOrders.data ?? [],
    awards: awards.data ?? [],
    buyers: buyers.data ?? [],
  });
}

export async function loadContractCore(contractId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select(
      // opportunities is embedded through an explicit constraint: opportunities.rebid_from_contract_id
      // points back at contracts, so an unhinted embed is ambiguous.
      "id, title, contract_number, start_on, verified_end_on, opportunity_id, client_id, source_document_id, source_fact_id, clients(name), opportunities!contracts_opportunity_same_org_fkey(id, title)",
    )
    .eq("id", contractId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function loadContractOverviewExtras(contractId: string, opportunityId: string | null) {
  const supabase = await createClient();
  const [alerts, compliance, award, federal, options, purchaseOrders, renewals] = await Promise.all([
    // A contract can hold several bucket rows at once, so this is a list; the model picks the most
    // urgent. `maybeSingle()` here used to throw as soon as a second bucket existed.
    supabase
      .from("contract_alerts")
      .select("id, bucket, days_until, verified_end_on, computed_on")
      .eq("contract_id", contractId),
    supabase
      .from("compliance_items")
      .select("id, kind, statement, expires_on, source_fact_id")
      .eq("contract_id", contractId)
      .order("expires_on", { ascending: true }),
    opportunityId
      ? supabase
          .from("awards")
          .select("id, opportunity_id, amount_nte, winner_name, rank, notice, awarded_on, source_fact_id, source_document_id")
          .eq("opportunity_id", opportunityId)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("federal_identifiers")
      .select("id, scheme, identifier, notes")
      .eq("contract_id", contractId),
    supabase
      .from("contract_options")
      .select("id, contract_id, label, exercise_by, source_fact_id")
      .eq("contract_id", contractId)
      .order("exercise_by", { ascending: true }),
    supabase
      .from("purchase_orders")
      .select("id, contract_id, po_number, issued_on, total_amount, source_fact_id, source_document_id")
      .eq("contract_id", contractId),
    supabase
      .from("renewals")
      .select("id, contract_id, notice, notice_due_on, option_year, escalation_index, escalation_pct, source_fact_id")
      .eq("contract_id", contractId),
  ]);

  return {
    alerts: alerts.data ?? [],
    compliance: compliance.data ?? [],
    award: award.data,
    federal: federal.data ?? [],
    options: options.data ?? [],
    purchaseOrders: purchaseOrders.data ?? [],
    renewals: renewals.data ?? [],
  };
}

export async function loadContractServicePlans(contractId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contract_service_plans")
    .select(
      "id, site_name, post_label, guard_classification, hours_per_week, schedule_note, notes, source_fact_id, source_document_id",
    )
    .eq("contract_id", contractId)
    .order("site_name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadContractCommercial(contractId: string, opportunityId: string | null) {
  const supabase = await createClient();
  const [options, renewals, pos, federal, award] = await Promise.all([
    supabase.from("contract_options").select("id, label, exercise_by").eq("contract_id", contractId),
    supabase
      .from("renewals")
      .select("id, notice, notice_due_on, escalation_index, escalation_pct, option_year")
      .eq("contract_id", contractId),
    supabase
      .from("purchase_orders")
      .select(
        "id, po_number, issued_on, total_amount, payment_terms, vehicle_ref, notes, purchase_order_lines(id, line_label, quantity, unit, unit_rate, extended_amount, rate_type)",
      )
      .eq("contract_id", contractId)
      .order("issued_on", { ascending: false }),
    supabase
      .from("federal_identifiers")
      .select("id, scheme, identifier, notes")
      .eq("contract_id", contractId),
    opportunityId
      ? supabase
          .from("awards")
          .select("id, amount_nte, winner_name, notice")
          .eq("opportunity_id", opportunityId)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  return {
    options: options.data ?? [],
    renewals: renewals.data ?? [],
    purchaseOrders: pos.data ?? [],
    federal: federal.data ?? [],
    award: award.data,
  };
}

export async function loadContractChanges(contractId: string, opportunityId: string | null) {
  const supabase = await createClient();
  const [amendments, options, renewals, award] = await Promise.all([
    supabase
      .from("contract_amendments")
      .select("id, contract_id, note, title, amendment_number, effective_on, source_fact_id, source_document_id")
      .eq("contract_id", contractId)
      .order("effective_on", { ascending: false }),
    supabase
      .from("contract_options")
      .select("id, contract_id, label, exercise_by, source_fact_id")
      .eq("contract_id", contractId)
      .order("exercise_by", { ascending: true }),
    supabase
      .from("renewals")
      .select("id, contract_id, notice, notice_due_on, option_year, escalation_index, escalation_pct, source_fact_id")
      .eq("contract_id", contractId),
    opportunityId
      ? supabase
          .from("awards")
          .select("id, opportunity_id, amount_nte, awarded_on, notice, winner_name, source_fact_id, source_document_id")
          .eq("opportunity_id", opportunityId)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (amendments.error) throw new Error(amendments.error.message);
  if (options.error) throw new Error(options.error.message);
  return {
    amendments: amendments.data ?? [],
    options: options.data ?? [],
    renewals: renewals.data ?? [],
    award: award.data,
  };
}

export async function loadContractRenewal(contractId: string) {
  const supabase = await createClient();
  const [alerts, renewals, options, compliance, rebids] = await Promise.all([
    supabase
      .from("contract_alerts")
      .select("id, contract_id, bucket, days_until, verified_end_on, computed_on")
      .eq("contract_id", contractId),
    supabase
      .from("renewals")
      .select("id, contract_id, notice, notice_due_on, escalation_index, escalation_pct, option_year, source_fact_id")
      .eq("contract_id", contractId),
    supabase
      .from("contract_options")
      .select("id, contract_id, label, exercise_by, source_fact_id")
      .eq("contract_id", contractId),
    supabase
      .from("compliance_items")
      .select("id, kind, statement, expires_on, source_fact_id")
      .eq("contract_id", contractId)
      .order("expires_on", { ascending: true }),
    supabase
      .from("opportunities")
      .select("id, title, stage, response_due_on")
      .eq("rebid_from_contract_id", contractId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    alerts: alerts.data ?? [],
    renewals: renewals.data ?? [],
    options: options.data ?? [],
    compliance: compliance.data ?? [],
    rebids: rebids.data ?? [],
  };
}
