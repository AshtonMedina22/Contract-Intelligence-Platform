/**
 * Recompete Radar — which contracts in the verified corpus are coming back to market.
 *
 * The radar is assembled only from records that already exist: `awards`, `contracts`,
 * `contract_options`, `renewals`, `opportunities`, `clients` and `win_loss_reviews`. It contains no
 * prediction model. "Expected rebid" is never a forecast: it is the verified contract end date or a
 * recorded option exercise-by date, restated, with the field it came from named. When neither
 * exists the row says the rebid timing is unknown rather than guessing one.
 *
 * The radar also never mixes the two holders. A contract L&P holds is an internal renewal and lives
 * on `/contracts/renewals`; the radar keeps those rows out of the market list and links to that
 * queue instead. Pure module: no React, no Supabase.
 */

export const MARKET_RADAR_LABEL = "Market radar — recompetes observed in the corpus";
export const LP_RENEWALS_LABEL = "L&P-held renewals";
export const LP_RENEWALS_ROUTE = "/contracts/renewals";

export const MARKET_RADAR_SCOPE_NOTE =
  "Observed recompetes on contracts L&P does not hold. Built from verified awards, contracts, options and renewal notices only — no forecast, no pipeline estimate, and no share of any market. Watch and Start Pursuit are operator actions; automation never auto-creates pursuits from this list.";
export const LP_RENEWALS_SCOPE_NOTE =
  "Two different concepts: Market radar rows are external recompetes; L&P-held renewals are the internal queue at /contracts/renewals, bucketed from verified_end_on. Contracts L&P holds are excluded from the market list above and never mixed into Market KPIs.";
export const RADAR_NO_PREDICTION_NOTE =
  "Expected rebid restates a verified date. It is never inferred from a term length, a typical cycle, or an award date.";

/** Operator watch statuses for Market radar candidates (recompete_watches). */
export const RECOMPETE_WATCH_STATUSES = [
  "WATCHING",
  "READY_FOR_CAPTURE",
  "PURSUIT_STARTED",
  "DISMISSED",
  "STALE",
] as const;
export type RecompeteWatchStatus = (typeof RECOMPETE_WATCH_STATUSES)[number];

export const MARKET_START_PURSUIT_NOTE =
  "Start Pursuit from a Market radar row creates a new INTAKE pursuit with provenance to buyer/award/source and an AI_EXTRACTED research fact. It never calls cloneRebidFromContract, never copies pricing, and never invents a due date.";

/** Who holds the contract that would be recompeted. */
export type RadarHolder = "L_AND_P" | "COMPETITOR" | "UNKNOWN";

/** How complete the evidence behind a radar row is. */
export type RadarDataStatus = "VERIFIED" | "PARTIAL" | "UNKNOWN";

export const RADAR_DATA_STATUS_LABELS: Record<RadarDataStatus, string> = {
  VERIFIED: "Verified — incumbent, expiration and source all recorded",
  PARTIAL: "Partial — some fields recorded, the rest are absent",
  UNKNOWN: "Unknown — only the buyer and the contract are recorded",
};

export const RADAR_HOLDER_LABELS: Record<RadarHolder, string> = {
  L_AND_P: "L&P-held",
  COMPETITOR: "Competitor-held",
  UNKNOWN: "Holder not recorded",
};

/** Matches L&P's own name in a buyer-published winner field. */
export const L_AND_P_NAME_RE = /\bl\s*(?:&|and)\s*p\b|\blp\s+global\b/i;

export function isLandPName(name: string | null | undefined): boolean {
  return typeof name === "string" && L_AND_P_NAME_RE.test(name);
}

export type RadarAward = {
  id: string;
  opportunity_id: string | null;
  winner_name: string | null;
  awarded_on: string | null;
  notice: string | null;
  source_fact_id: string | null;
  source_document_id: string | null;
};

export type RadarContract = {
  id: string;
  client_id: string | null;
  opportunity_id: string | null;
  title: string;
  contract_number: string | null;
  start_on: string | null;
  verified_end_on: string | null;
  source_fact_id: string | null;
  source_document_id: string | null;
};

export type RadarContractOption = {
  id: string;
  contract_id: string;
  label: string;
  exercise_by: string | null;
  source_fact_id: string | null;
};

export type RadarRenewalNotice = {
  id: string;
  contract_id: string;
  notice_due_on: string | null;
  option_year: number | null;
  source_fact_id: string | null;
};

export type RadarOpportunity = {
  id: string;
  client_id: string | null;
  title: string;
  service_type: string | null;
  site_location: string | null;
  source_url: string | null;
};

export type RadarWinLoss = {
  opportunity_id: string;
  outcome: string;
  winner_name: string | null;
};

export type RadarBuyer = { id: string; name: string };

export type RadarSource = { label: string; href: string | null };

export type RecompeteRadarRow = {
  key: string;
  holder: RadarHolder;
  buyerId: string | null;
  buyerName: string | null;
  contractLabel: string;
  contractId: string | null;
  opportunityId: string | null;
  serviceType: string | null;
  geography: string | null;
  /** Name plus the record that named it, so an incumbent is never an assumption. */
  incumbent: { name: string; basis: string } | null;
  expirationOn: string | null;
  options: { label: string; exerciseBy: string | null }[];
  nextOptionExerciseBy: string | null;
  /** `on` is null whenever no verified date exists; `basis` always names the field used. */
  expectedRebid: { on: string | null; basis: string };
  sources: RadarSource[];
  dataStatus: RadarDataStatus;
  /** Named gaps, rendered in the table so an absent field reads as absent. */
  missing: string[];
};

export type RecompeteRadarInput = {
  awards?: RadarAward[];
  contracts?: RadarContract[];
  contractOptions?: RadarContractOption[];
  renewalNotices?: RadarRenewalNotice[];
  opportunities?: RadarOpportunity[];
  buyers?: RadarBuyer[];
  winLoss?: RadarWinLoss[];
};

export type RecompeteRadarFilters = {
  service?: string | null;
  geography?: string | null;
  /** Inclusive lower bound on the expected-rebid date. Rows with no date are excluded when set. */
  from?: string | null;
  /** Inclusive upper bound on the expected-rebid date. */
  to?: string | null;
};

export type RecompeteRadar = {
  /** Rows L&P does not hold — the market radar table. */
  market: RecompeteRadarRow[];
  /** Rows L&P holds — a count and a link to the renewal queue, never merged into `market`. */
  lpHeld: RecompeteRadarRow[];
  counts: {
    market: number;
    lpHeld: number;
    verified: number;
    partial: number;
    unknown: number;
    withIncumbent: number;
    withExpiration: number;
  };
  /** Distinct values actually present, so a filter never offers a value the corpus lacks. */
  facets: { services: string[]; geographies: string[] };
};

function earliest(dates: (string | null | undefined)[]): string | null {
  const present = dates.filter((d): d is string => typeof d === "string" && d.length > 0).sort();
  return present[0] ?? null;
}

function dedupe(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => typeof v === "string" && v.trim().length > 0))].sort();
}

/**
 * Groups every award and contract in the corpus by the contract (or, absent a contract row, by the
 * pursuit) that would be recompeted, then states what is known and what is missing.
 */
export function buildRecompeteRadar(input: RecompeteRadarInput): RecompeteRadar {
  const awards = input.awards ?? [];
  const contracts = input.contracts ?? [];
  const options = input.contractOptions ?? [];
  const notices = input.renewalNotices ?? [];
  const opportunities = input.opportunities ?? [];
  const buyers = input.buyers ?? [];
  const winLoss = input.winLoss ?? [];

  const buyerName = new Map(buyers.map((b) => [b.id, b.name]));
  const opportunityById = new Map(opportunities.map((o) => [o.id, o]));
  const winLossByOpportunity = new Map(winLoss.map((w) => [w.opportunity_id, w]));

  const optionsByContract = new Map<string, RadarContractOption[]>();
  for (const option of options) {
    const list = optionsByContract.get(option.contract_id) ?? [];
    list.push(option);
    optionsByContract.set(option.contract_id, list);
  }
  const noticesByContract = new Map<string, RadarRenewalNotice[]>();
  for (const notice of notices) {
    const list = noticesByContract.get(notice.contract_id) ?? [];
    list.push(notice);
    noticesByContract.set(notice.contract_id, list);
  }
  const awardsByOpportunity = new Map<string, RadarAward[]>();
  for (const award of awards) {
    if (!award.opportunity_id) continue;
    const list = awardsByOpportunity.get(award.opportunity_id) ?? [];
    list.push(award);
    awardsByOpportunity.set(award.opportunity_id, list);
  }

  const rows: RecompeteRadarRow[] = [];
  const contractedOpportunities = new Set<string>();

  for (const contract of contracts) {
    if (contract.opportunity_id) contractedOpportunities.add(contract.opportunity_id);
    const opportunity = contract.opportunity_id ? opportunityById.get(contract.opportunity_id) : null;
    const contractAwards = contract.opportunity_id
      ? (awardsByOpportunity.get(contract.opportunity_id) ?? [])
      : [];
    rows.push(
      buildRow({
        key: `contract:${contract.id}`,
        contract,
        opportunity: opportunity ?? null,
        awards: contractAwards,
        winLoss: contract.opportunity_id ? (winLossByOpportunity.get(contract.opportunity_id) ?? null) : null,
        options: optionsByContract.get(contract.id) ?? [],
        notices: noticesByContract.get(contract.id) ?? [],
        buyerName,
      }),
    );
  }

  // An award with no contract row of ours is still a recompete: somebody holds that work.
  for (const [opportunityId, opportunityAwards] of awardsByOpportunity) {
    if (contractedOpportunities.has(opportunityId)) continue;
    rows.push(
      buildRow({
        key: `opportunity:${opportunityId}`,
        contract: null,
        opportunity: opportunityById.get(opportunityId) ?? null,
        awards: opportunityAwards,
        winLoss: winLossByOpportunity.get(opportunityId) ?? null,
        options: [],
        notices: [],
        buyerName,
        opportunityId,
      }),
    );
  }

  rows.sort((a, b) => {
    const aDate = a.expectedRebid.on;
    const bDate = b.expectedRebid.on;
    if (aDate && bDate && aDate !== bDate) return aDate < bDate ? -1 : 1;
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;
    return (a.buyerName ?? "").localeCompare(b.buyerName ?? "") || a.contractLabel.localeCompare(b.contractLabel);
  });

  const market = rows.filter((r) => r.holder !== "L_AND_P");
  const lpHeld = rows.filter((r) => r.holder === "L_AND_P");

  return {
    market,
    lpHeld,
    counts: {
      market: market.length,
      lpHeld: lpHeld.length,
      verified: market.filter((r) => r.dataStatus === "VERIFIED").length,
      partial: market.filter((r) => r.dataStatus === "PARTIAL").length,
      unknown: market.filter((r) => r.dataStatus === "UNKNOWN").length,
      withIncumbent: market.filter((r) => r.incumbent != null).length,
      withExpiration: market.filter((r) => r.expirationOn != null).length,
    },
    facets: {
      services: dedupe(market.map((r) => r.serviceType)),
      geographies: dedupe(market.map((r) => r.geography)),
    },
  };
}

function buildRow(args: {
  key: string;
  contract: RadarContract | null;
  opportunity: RadarOpportunity | null;
  awards: RadarAward[];
  winLoss: RadarWinLoss | null;
  options: RadarContractOption[];
  notices: RadarRenewalNotice[];
  buyerName: Map<string, string>;
  opportunityId?: string;
}): RecompeteRadarRow {
  const { contract, opportunity, awards, winLoss, options, notices, buyerName } = args;

  const buyerId = contract?.client_id ?? opportunity?.client_id ?? null;
  const award = awards.find((a) => a.winner_name != null) ?? awards[0] ?? null;

  let incumbent: RecompeteRadarRow["incumbent"] = null;
  if (award?.winner_name) {
    incumbent = { name: award.winner_name, basis: "awards.winner_name (buyer award notice)" };
  } else if (winLoss?.winner_name) {
    incumbent = { name: winLoss.winner_name, basis: "win_loss_reviews.winner_name (recorded outcome)" };
  }

  // A contract row in this tenant is L&P's own contract. Otherwise the holder is only known when a
  // buyer-published winner names somebody.
  let holder: RadarHolder = "UNKNOWN";
  if (contract != null || winLoss?.outcome === "WON") holder = "L_AND_P";
  else if (incumbent) holder = isLandPName(incumbent.name) ? "L_AND_P" : "COMPETITOR";

  const optionRows = options.map((o) => ({ label: o.label, exerciseBy: o.exercise_by }));
  const nextOptionExerciseBy = earliest([
    ...options.map((o) => o.exercise_by),
    ...notices.map((n) => n.notice_due_on),
  ]);
  const expirationOn = contract?.verified_end_on ?? null;

  let expectedRebid: RecompeteRadarRow["expectedRebid"];
  if (expirationOn) {
    expectedRebid = { on: expirationOn, basis: "contracts.verified_end_on (verified contract end)" };
  } else if (nextOptionExerciseBy) {
    expectedRebid = {
      on: nextOptionExerciseBy,
      basis: "earliest contract_options.exercise_by / renewals.notice_due_on",
    };
  } else {
    expectedRebid = {
      on: null,
      basis: "No verified end date, option exercise-by, or renewal notice date on file",
    };
  }

  const sources: RadarSource[] = [];
  if (award?.source_document_id) {
    sources.push({
      label: `award document ${award.source_document_id.slice(0, 8)}`,
      href: `/ingestion/verification/${award.source_document_id}`,
    });
  } else if (award?.source_fact_id) {
    sources.push({ label: `award fact ${award.source_fact_id.slice(0, 8)}`, href: null });
  }
  if (contract?.source_document_id) {
    sources.push({
      label: `contract document ${contract.source_document_id.slice(0, 8)}`,
      href: `/ingestion/verification/${contract.source_document_id}`,
    });
  } else if (contract?.source_fact_id) {
    sources.push({ label: `contract fact ${contract.source_fact_id.slice(0, 8)}`, href: null });
  }
  if (opportunity?.source_url) {
    sources.push({ label: "solicitation source URL", href: opportunity.source_url });
  }

  const missing: string[] = [];
  if (!incumbent) missing.push("incumbent");
  if (!expirationOn) missing.push("verified expiration");
  if (optionRows.length === 0) missing.push("options");
  if (sources.length === 0) missing.push("source");

  let dataStatus: RadarDataStatus = "UNKNOWN";
  if (incumbent && expirationOn && sources.length > 0) dataStatus = "VERIFIED";
  else if (incumbent || expirationOn || sources.length > 0) dataStatus = "PARTIAL";

  const contractLabel =
    contract?.contract_number ?? contract?.title ?? opportunity?.title ?? "Unlabelled contract";

  return {
    key: args.key,
    holder,
    buyerId,
    buyerName: buyerId ? (buyerName.get(buyerId) ?? null) : null,
    contractLabel,
    contractId: contract?.id ?? null,
    opportunityId: contract?.opportunity_id ?? args.opportunityId ?? opportunity?.id ?? null,
    serviceType: opportunity?.service_type ?? null,
    geography: opportunity?.site_location ?? null,
    incumbent,
    expirationOn,
    options: optionRows,
    nextOptionExerciseBy,
    expectedRebid,
    sources,
    dataStatus,
    missing,
  };
}

/** Filters only on fields that exist on the row. An absent field never silently matches. */
export function filterRadarRows(
  rows: RecompeteRadarRow[],
  filters: RecompeteRadarFilters,
): RecompeteRadarRow[] {
  const service = filters.service?.trim().toLowerCase() || null;
  const geography = filters.geography?.trim().toLowerCase() || null;
  const from = filters.from?.trim() || null;
  const to = filters.to?.trim() || null;

  return rows.filter((row) => {
    if (service && (row.serviceType ?? "").toLowerCase() !== service) return false;
    if (geography && (row.geography ?? "").toLowerCase() !== geography) return false;
    if (from || to) {
      const on = row.expectedRebid.on;
      if (!on) return false;
      if (from && on < from) return false;
      if (to && on > to) return false;
    }
    return true;
  });
}
