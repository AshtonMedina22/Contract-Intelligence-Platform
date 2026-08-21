import { createClient } from "@/lib/supabase/server";

export type BuyerPortfolioRow = {
  id: string;
  name: string;
  opportunity_count: number;
  award_count: number;
  contract_count: number;
  win_loss_count: number;
  research_count: number;
  latest_outcome: string | null;
  /** Deep-link target for the Solicitations / Awards columns; null when this buyer has no pursuit. */
  latest_opportunity_id: string | null;
  latest_opportunity_title: string | null;
  /** Deep-link target for the Contracts column; null when no contract is on file. */
  latest_contract_id: string | null;
};

export type PursuitIntelSummary = {
  opportunityId: string;
  buyerName: string | null;
  opportunityTitle: string;
  winLoss: {
    outcome: string;
    documented_reason: string | null;
    internal_analysis: string | null;
    lessons_learned: string | null;
    winner_name: string | null;
    lp_price: number | null;
    winning_price: number | null;
  } | null;
  competitorBids: {
    name: string;
    quoted_amount: number | null;
    rank: number | null;
    source_url: string | null;
  }[];
  evaluationScores: {
    respondent_name: string;
    points: number;
    max_points: number | null;
    rank: number | null;
    notes: string | null;
  }[];
  researchCount: number;
  awardNte: number | null;
};

/** Buyer portfolio from verified corpus joins — not CRM. */
export async function loadBuyerPortfolio(): Promise<BuyerPortfolioRow[]> {
  const supabase = await createClient();
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, name")
    .order("name")
    .limit(200);
  if (error) throw new Error(error.message);
  if (!clients?.length) return [];

  const ids = clients.map((c) => c.id);
  const [opps, awards, contracts, reviews, research] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, client_id, title, updated_at")
      .in("client_id", ids)
      .order("updated_at", { ascending: false }),
    supabase.from("awards").select("id, opportunity_id"),
    supabase
      .from("contracts")
      .select("id, client_id, updated_at")
      .in("client_id", ids)
      .order("updated_at", { ascending: false }),
    supabase.from("win_loss_reviews").select("id, opportunity_id, outcome"),
    supabase.from("research_facts").select("id, client_id").in("client_id", ids),
  ]);

  const oppByClient = new Map<string, string[]>();
  const latestOppByClient = new Map<string, { id: string; title: string }>();
  for (const o of opps.data ?? []) {
    if (!o.client_id) continue;
    const list = oppByClient.get(o.client_id) ?? [];
    list.push(o.id);
    oppByClient.set(o.client_id, list);
    if (!latestOppByClient.has(o.client_id)) {
      latestOppByClient.set(o.client_id, { id: o.id, title: o.title });
    }
  }
  const latestContractByClient = new Map<string, string>();
  for (const c of contracts.data ?? []) {
    if (!c.client_id || latestContractByClient.has(c.client_id)) continue;
    latestContractByClient.set(c.client_id, c.id);
  }
  const oppToClient = new Map<string, string>();
  for (const [clientId, oppIds] of oppByClient) {
    for (const oid of oppIds) oppToClient.set(oid, clientId);
  }

  const awardByClient = new Map<string, number>();
  for (const a of awards.data ?? []) {
    const clientId = a.opportunity_id ? oppToClient.get(a.opportunity_id) : null;
    if (!clientId) continue;
    awardByClient.set(clientId, (awardByClient.get(clientId) ?? 0) + 1);
  }

  const contractByClient = new Map<string, number>();
  for (const c of contracts.data ?? []) {
    if (!c.client_id) continue;
    contractByClient.set(c.client_id, (contractByClient.get(c.client_id) ?? 0) + 1);
  }

  const reviewByClient = new Map<string, { count: number; latest: string | null }>();
  for (const r of reviews.data ?? []) {
    const clientId = r.opportunity_id ? oppToClient.get(r.opportunity_id) : null;
    if (!clientId) continue;
    const cur = reviewByClient.get(clientId) ?? { count: 0, latest: null };
    cur.count += 1;
    cur.latest = r.outcome;
    reviewByClient.set(clientId, cur);
  }

  const researchByClient = new Map<string, number>();
  for (const r of research.data ?? []) {
    if (!r.client_id) continue;
    researchByClient.set(r.client_id, (researchByClient.get(r.client_id) ?? 0) + 1);
  }

  return clients.map((c) => {
    const review = reviewByClient.get(c.id);
    const latestOpp = latestOppByClient.get(c.id) ?? null;
    return {
      id: c.id,
      name: c.name,
      opportunity_count: oppByClient.get(c.id)?.length ?? 0,
      award_count: awardByClient.get(c.id) ?? 0,
      contract_count: contractByClient.get(c.id) ?? 0,
      win_loss_count: review?.count ?? 0,
      research_count: researchByClient.get(c.id) ?? 0,
      latest_outcome: review?.latest ?? null,
      latest_opportunity_id: latestOpp?.id ?? null,
      latest_opportunity_title: latestOpp?.title ?? null,
      latest_contract_id: latestContractByClient.get(c.id) ?? null,
    };
  });
}

export async function loadPursuitIntelSummary(opportunityId: string): Promise<PursuitIntelSummary> {
  const supabase = await createClient();
  const [
    { data: opportunity },
    { data: winLoss },
    { data: bids },
    { data: scores },
    { data: award },
  ] = await Promise.all([
    supabase.from("opportunities").select("id, title, client_id, clients(name)").eq("id", opportunityId).maybeSingle(),
    supabase
      .from("win_loss_reviews")
      .select(
        "outcome, documented_reason, internal_analysis, lessons_learned, winner_name, lp_price, winning_price",
      )
      .eq("opportunity_id", opportunityId)
      .maybeSingle(),
    supabase
      .from("competitor_bids")
      .select("quoted_amount, rank, source_url, competitors(name)")
      .eq("opportunity_id", opportunityId)
      .order("rank", { ascending: true }),
    supabase
      .from("evaluation_scores")
      .select("respondent_name, points, max_points, rank, notes")
      .eq("opportunity_id", opportunityId)
      .order("rank", { ascending: true }),
    supabase.from("awards").select("amount_nte").eq("opportunity_id", opportunityId).limit(1).maybeSingle(),
  ]);

  const client = opportunity
    ? Array.isArray(opportunity.clients)
      ? opportunity.clients[0]
      : opportunity.clients
    : null;

  let researchCount = 0;
  if (opportunity?.client_id) {
    const { count } = await supabase
      .from("research_facts")
      .select("id", { count: "exact", head: true })
      .eq("client_id", opportunity.client_id);
    researchCount = count ?? 0;
  }

  return {
    opportunityId,
    buyerName: client?.name ?? null,
    opportunityTitle: opportunity?.title ?? opportunityId,
    winLoss: winLoss
      ? {
          outcome: winLoss.outcome,
          documented_reason: winLoss.documented_reason,
          internal_analysis: winLoss.internal_analysis,
          lessons_learned: winLoss.lessons_learned,
          winner_name: winLoss.winner_name,
          lp_price: winLoss.lp_price,
          winning_price: winLoss.winning_price,
        }
      : null,
    competitorBids: (bids ?? []).map((b) => {
      const competitor = Array.isArray(b.competitors) ? b.competitors[0] : b.competitors;
      return {
        name: competitor?.name ?? "Unknown",
        quoted_amount: b.quoted_amount,
        rank: b.rank,
        source_url: b.source_url,
      };
    }),
    evaluationScores: (scores ?? []).map((s) => ({
      respondent_name: s.respondent_name,
      points: s.points,
      max_points: s.max_points,
      rank: s.rank,
      notes: s.notes,
    })),
    researchCount,
    awardNte: award?.amount_nte ?? null,
  };
}
