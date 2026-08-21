/**
 * F12 inventory loaders — RLS-scoped reads for compliance + registrations + matches.
 */

import type { createClient } from "@/lib/supabase/server";
import type {
  ComplianceInventoryItem,
  OrganizationRegistration,
  RequirementComplianceMatch,
} from "./types";
import { rollupEligibility, type EligibilityRollup } from "./eligibility";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const REG_SELECT =
  "id, organization_id, uei, cage, sam_status, sam_expiration_on, naics, psc, vehicles_notes, source_document_id, source_document_version_id, source_url, source_fact_id, verification_status, supersedes_id, as_of, notes, created_at, verified_by, verified_at";

const ITEM_SELECT =
  "id, organization_id, contract_id, kind, statement, expires_on, effective_on, verification_status, issuer, credential_number, holder_name, coverage_json, source_document_id, source_document_version_id, source_fact_id, source_url, supersedes_id, organization_registration_id, created_at, verified_by, verified_at";

const MATCH_SELECT =
  "id, organization_id, requirement_id, opportunity_id, compliance_item_id, organization_registration_id, match_status, rationale, evidence_links, required_coverage_json, created_at";

export async function loadLatestOrganizationRegistration(
  supabase: Supabase,
  organizationId: string,
): Promise<OrganizationRegistration | null> {
  // New rows set supersedes_id → prior. Latest = newest created_at.
  const { data } = await supabase
    .from("organization_registrations")
    .select(REG_SELECT)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? normalizeRegistration(data) : null;
}

export async function loadOrganizationRegistrationHistory(
  supabase: Supabase,
  organizationId: string,
  limit = 20,
): Promise<OrganizationRegistration[]> {
  const { data } = await supabase
    .from("organization_registrations")
    .select(REG_SELECT)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(normalizeRegistration);
}

export async function loadComplianceInventory(
  supabase: Supabase,
  organizationId: string,
  opts?: { includeSuperseded?: boolean; limit?: number },
): Promise<ComplianceInventoryItem[]> {
  void opts?.includeSuperseded;
  const { data } = await supabase
    .from("compliance_items")
    .select(ITEM_SELECT)
    .eq("organization_id", organizationId)
    .order("expires_on", { ascending: true, nullsFirst: false })
    .limit(opts?.limit ?? 200);
  return (data ?? []) as ComplianceInventoryItem[];
}

export async function loadComplianceItemHistory(
  supabase: Supabase,
  organizationId: string,
  itemId: string,
): Promise<ComplianceInventoryItem[]> {
  const chain: ComplianceInventoryItem[] = [];
  let currentId: string | null = itemId;
  const seen = new Set<string>();
  while (currentId && !seen.has(currentId) && chain.length < 20) {
    seen.add(currentId);
    const res = await supabase
      .from("compliance_items")
      .select(ITEM_SELECT)
      .eq("organization_id", organizationId)
      .eq("id", currentId)
      .maybeSingle();
    const row = res.data as ComplianceInventoryItem | null;
    if (!row) break;
    chain.push(row);
    currentId = row.supersedes_id ?? null;
  }
  return chain;
}

export async function loadRequirementComplianceMatches(
  supabase: Supabase,
  opportunityId: string,
): Promise<RequirementComplianceMatch[]> {
  const { data } = await supabase
    .from("requirement_compliance_matches")
    .select(MATCH_SELECT)
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []) as RequirementComplianceMatch[];
}

export async function loadEligibilityRollupForOpportunity(
  supabase: Supabase,
  opportunityId: string,
): Promise<EligibilityRollup> {
  const matches = await loadRequirementComplianceMatches(supabase, opportunityId);
  return rollupEligibility(matches);
}

function normalizeRegistration(row: Record<string, unknown>): OrganizationRegistration {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    uei: (row.uei as string | null) ?? null,
    cage: (row.cage as string | null) ?? null,
    sam_status: (row.sam_status as string | null) ?? null,
    sam_expiration_on: (row.sam_expiration_on as string | null) ?? null,
    naics: Array.isArray(row.naics) ? (row.naics as string[]) : [],
    psc: Array.isArray(row.psc) ? (row.psc as string[]) : [],
    vehicles_notes: (row.vehicles_notes as string | null) ?? null,
    source_document_id: (row.source_document_id as string | null) ?? null,
    source_document_version_id: (row.source_document_version_id as string | null) ?? null,
    source_url: (row.source_url as string | null) ?? null,
    source_fact_id: (row.source_fact_id as string | null) ?? null,
    verification_status: String(row.verification_status ?? "AI_EXTRACTED") as OrganizationRegistration["verification_status"],
    supersedes_id: (row.supersedes_id as string | null) ?? null,
    as_of: (row.as_of as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    created_at: (row.created_at as string | undefined) ?? undefined,
  };
}
