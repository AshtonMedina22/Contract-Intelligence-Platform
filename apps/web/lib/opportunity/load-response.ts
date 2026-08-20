import { createClient } from "@/lib/supabase/server";
import type {
  RequirementMatrixRow,
  RequirementResponseRow,
  ApprovalLayerKey,
  ApprovalStatus,
} from "./response";
import { DEFAULT_SUBMISSION_CHECKLIST } from "./response";

export async function loadRequirementMatrix(opportunityId: string): Promise<RequirementMatrixRow[]> {
  const supabase = await createClient();
  const { data: solicitations } = await supabase
    .from("solicitations")
    .select("id")
    .eq("opportunity_id", opportunityId);
  const ids = (solicitations ?? []).map((s) => s.id);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("requirements")
    .select(
      "id, statement, solicitation_id, source_fact_id, mandatory, scored, weight_pct, section_ref, source_page, response_required, attachment_required, form_name, owner_name, verification_note, matrix_status",
    )
    .in("solicitation_id", ids)
    .order("created_at");

  return (data ?? []).map((r) => ({
    id: r.id,
    statement: r.statement,
    solicitation_id: r.solicitation_id,
    source_fact_id: r.source_fact_id,
    mandatory: r.mandatory ?? true,
    scored: r.scored ?? false,
    weight_pct: r.weight_pct,
    section_ref: r.section_ref,
    source_page: r.source_page,
    response_required: r.response_required ?? true,
    attachment_required: r.attachment_required ?? false,
    form_name: r.form_name,
    owner_name: r.owner_name,
    verification_note: r.verification_note,
    matrix_status: (r.matrix_status ?? "OPEN") as RequirementMatrixRow["matrix_status"],
  }));
}

export async function loadRequirementResponses(
  opportunityId: string,
): Promise<RequirementResponseRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("requirement_responses")
    .select(
      "id, requirement_id, draft_html, evidence_state, draft_status, sources_used, assumptions, missing_information, confidence",
    )
    .eq("opportunity_id", opportunityId);
  return (data ?? []) as RequirementResponseRow[];
}

export async function loadApprovalLayers(opportunityId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pursuit_approval_layers")
    .select("id, layer_key, enabled, status, approver_id, notes, decided_at")
    .eq("opportunity_id", opportunityId)
    .order("layer_key");
  return (data ?? []) as {
    id: string;
    layer_key: ApprovalLayerKey;
    enabled: boolean;
    status: ApprovalStatus;
    approver_id: string | null;
    notes: string | null;
    decided_at: string | null;
  }[];
}

export async function loadSubmissionPacket(opportunityId: string) {
  const supabase = await createClient();
  const [{ data: packet }, { data: items }] = await Promise.all([
    supabase.from("submission_packets").select("*").eq("opportunity_id", opportunityId).maybeSingle(),
    supabase
      .from("submission_checklist_items")
      .select("id, item_key, label, required, completed, notes, sort_order")
      .eq("opportunity_id", opportunityId)
      .order("sort_order"),
  ]);
  return {
    packet: packet as Record<string, unknown> | null,
    checklist: items ?? [],
    defaults: DEFAULT_SUBMISSION_CHECKLIST,
  };
}

export async function loadResponseContext(opportunityId: string) {
  const supabase = await createClient();
  const [
    { data: winLoss },
    { data: competitorBids },
    { data: proposalSections },
    { data: clients },
  ] = await Promise.all([
    supabase
      .from("win_loss_reviews")
      .select("outcome, documented_reason, lessons_learned, winner_name, lp_price, winning_price")
      .eq("opportunity_id", opportunityId)
      .maybeSingle(),
    supabase
      .from("competitor_bids")
      .select("quoted_amount, note, competitors(name)")
      .eq("opportunity_id", opportunityId)
      .limit(8),
    supabase
      .from("proposal_sections")
      .select("section_key, title, excerpt, source_page")
      .eq("opportunity_id", opportunityId)
      .limit(12),
    supabase.from("opportunities").select("client_id, clients(name)").eq("id", opportunityId).maybeSingle(),
  ]);

  const client = clients
    ? Array.isArray(clients.clients)
      ? clients.clients[0]
      : clients.clients
    : null;

  return {
    buyerName: client?.name ?? null,
    winLoss,
    competitorBids: (competitorBids ?? []).map((b) => {
      const c = Array.isArray(b.competitors) ? b.competitors[0] : b.competitors;
      return { name: c?.name ?? "Unknown", quoted_amount: b.quoted_amount, note: b.note };
    }),
    proposalSections: proposalSections ?? [],
  };
}
