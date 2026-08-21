/**
 * Persist / load proposal_content_runs via user createClient() RLS.
 * Never createAdminClient.
 */

import { createClient } from "@/lib/supabase/server";

export type ProposalContentRunStatus =
  | "QUEUED"
  | "EXTRACTING"
  | "REVIEW_READY"
  | "FAILED"
  | "DONE";

export type ProposalContentRunPlan = {
  taxonomy?: string[];
  page_markers?: boolean;
  notes?: string;
};

export type ProposalContentRunSummary = {
  section_count?: number;
  section_keys?: string[];
  message?: string;
};

export type ProposalContentRunRow = {
  id: string;
  organization_id: string;
  document_id: string;
  opportunity_id: string | null;
  status: ProposalContentRunStatus;
  plan: ProposalContentRunPlan;
  result_summary: ProposalContentRunSummary;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  last_error: string | null;
};

export async function createProposalContentRun(opts: {
  organizationId: string;
  documentId: string;
  opportunityId?: string | null;
  plan?: ProposalContentRunPlan;
  createdBy?: string | null;
}): Promise<{ run: ProposalContentRunRow | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proposal_content_runs")
    .insert({
      organization_id: opts.organizationId,
      document_id: opts.documentId,
      opportunity_id: opts.opportunityId ?? null,
      status: "QUEUED",
      plan: opts.plan ?? {},
      result_summary: {},
      created_by: opts.createdBy ?? null,
    })
    .select("*")
    .maybeSingle();

  if (error) return { run: null, error: error.message };
  return { run: data as ProposalContentRunRow, error: null };
}

export async function updateProposalContentRun(
  runId: string,
  patch: {
    status?: ProposalContentRunStatus;
    plan?: ProposalContentRunPlan;
    result_summary?: ProposalContentRunSummary;
    last_error?: string | null;
    completed_at?: string | null;
  },
): Promise<{ ok: boolean; error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("proposal_content_runs")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export async function loadProposalContentRun(
  runId: string,
): Promise<{ run: ProposalContentRunRow | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proposal_content_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  if (error) return { run: null, error: error.message };
  return { run: (data as ProposalContentRunRow) ?? null, error: null };
}

export async function listProposalContentRunsForDocument(
  documentId: string,
  limit = 20,
): Promise<{ runs: ProposalContentRunRow[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proposal_content_runs")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { runs: [], error: error.message };
  return { runs: (data ?? []) as ProposalContentRunRow[], error: null };
}
