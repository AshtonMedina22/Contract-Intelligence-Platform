/**
 * F15 — Load contract obligations (RLS-scoped).
 */

import { createClient } from "@/lib/supabase/server";
import { countVerifiedObligationRisk, sortObligationsByUrgency } from "./risk-strip";
import type { ObligationRiskCounts } from "./risk-strip";
import { deriveObligationStatus } from "./status";
import type { ContractObligation } from "./types";

export type ContractObligationsBundle = {
  obligations: ContractObligation[];
  risk: ObligationRiskCounts;
  today: string;
};

export async function loadContractObligations(
  contractId: string,
  todayIso?: string,
): Promise<ContractObligationsBundle> {
  const today = todayIso ?? new Date().toISOString().slice(0, 10);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contract_obligations")
    .select(
      "id, organization_id, contract_id, obligation_type, title, description, source_clause_ref, source_document_id, source_document_version_id, source_page, source_fact_id, owner_user_id, effective_on, due_on, recurrence_rule, next_due_on, status, criticality, evidence_requirement_text, completion_evidence_document_id, completed_at, completed_by, waive_reason, superseded_by_id, amendment_id, verification_status, verified_by, verified_at, created_at, updated_at",
    )
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("loadContractObligations", error.message);
    return {
      obligations: [],
      risk: countVerifiedObligationRisk([], today),
      today,
    };
  }

  const rows = (data ?? []) as ContractObligation[];
  const withDerived = rows.map((row) => ({
    ...row,
    status: deriveObligationStatus({
      status: row.status,
      effectiveOn: row.effective_on,
      dueOn: row.due_on,
      nextDueOn: row.next_due_on,
      today,
    }),
  }));

  return {
    obligations: sortObligationsByUrgency(withDerived),
    risk: countVerifiedObligationRisk(withDerived, today),
    today,
  };
}
