import { createClient } from "@/lib/supabase/server";

export type ContractStatus =
  | "EXPIRED"
  | "180"
  | "120"
  | "90"
  | "60"
  | "30"
  | "ACTIVE"
  | "UNKNOWN";

/** Derive display status from verified dates only — never invent end dates. */
export function deriveContractStatus(input: {
  verifiedEndOn: string | null;
  alertBucket: string | null;
}): ContractStatus {
  if (!input.verifiedEndOn) return "UNKNOWN";
  if (input.alertBucket === "EXPIRED") return "EXPIRED";
  if (
    input.alertBucket === "180" ||
    input.alertBucket === "120" ||
    input.alertBucket === "90" ||
    input.alertBucket === "60" ||
    input.alertBucket === "30"
  ) {
    return input.alertBucket;
  }
  const end = new Date(`${input.verifiedEndOn}T00:00:00Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (end.getTime() < today.getTime()) return "EXPIRED";
  return "ACTIVE";
}

export async function loadContractCore(contractId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select(
      "id, title, contract_number, start_on, verified_end_on, opportunity_id, client_id, source_document_id, source_fact_id, clients(name), opportunities(id, title)",
    )
    .eq("id", contractId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function loadContractOverviewExtras(contractId: string, opportunityId: string | null) {
  const supabase = await createClient();
  const [alerts, compliance, award, federal, options] = await Promise.all([
    supabase
      .from("contract_alerts")
      .select("id, bucket, days_until, verified_end_on")
      .eq("contract_id", contractId)
      .maybeSingle(),
    supabase
      .from("compliance_items")
      .select("id, kind, statement, expires_on")
      .eq("contract_id", contractId)
      .order("expires_on", { ascending: true }),
    opportunityId
      ? supabase
          .from("awards")
          .select("id, amount_nte, winner_name, rank, notice")
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
      .select("id, label, exercise_by")
      .eq("contract_id", contractId)
      .order("exercise_by", { ascending: true }),
  ]);

  return {
    alert: alerts.data,
    compliance: compliance.data ?? [],
    award: award.data,
    federal: federal.data ?? [],
    options: options.data ?? [],
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

export async function loadContractChanges(contractId: string) {
  const supabase = await createClient();
  const [amendments, options] = await Promise.all([
    supabase
      .from("contract_amendments")
      .select("id, note, title, amendment_number, effective_on, source_fact_id, source_document_id")
      .eq("contract_id", contractId)
      .order("effective_on", { ascending: false }),
    supabase
      .from("contract_options")
      .select("id, label, exercise_by")
      .eq("contract_id", contractId)
      .order("exercise_by", { ascending: true }),
  ]);
  if (amendments.error) throw new Error(amendments.error.message);
  if (options.error) throw new Error(options.error.message);
  return {
    amendments: amendments.data ?? [],
    options: options.data ?? [],
  };
}

export async function loadContractRenewal(contractId: string) {
  const supabase = await createClient();
  const [alerts, renewals, options, compliance, rebids] = await Promise.all([
    supabase.from("contract_alerts").select("id, bucket, days_until, verified_end_on").eq("contract_id", contractId),
    supabase
      .from("renewals")
      .select("id, notice, notice_due_on, escalation_index, escalation_pct, option_year")
      .eq("contract_id", contractId),
    supabase.from("contract_options").select("id, label, exercise_by").eq("contract_id", contractId),
    supabase
      .from("compliance_items")
      .select("id, kind, statement, expires_on")
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
