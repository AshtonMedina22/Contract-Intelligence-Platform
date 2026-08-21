/**
 * Contract portfolio and renewal/rebid model — L&P's own awarded work, and what to do about it next.
 *
 * Everything here is derived from records that already exist: `contracts`, `contract_alerts`,
 * `contract_options`, `renewals`, `contract_amendments`, `awards`, `purchase_orders` and `clients`.
 * There is no new table, no forecast, and no inference about a term the corpus does not record.
 *
 * Four rules the whole module is built to keep:
 *
 *   1. **A date is verified or it is absent.** Status, buckets, expirations and next actions come
 *      from `contracts.verified_end_on` and from dates recorded on option/renewal rows. A contract
 *      with no verified end date says so and drops out of every bucket — it is never assumed active,
 *      never assumed expiring, and never given a guessed end from a term length or a start date.
 *   2. **A value is a named instrument or it is a dash.** There is no contract-value column in this
 *      schema. An award ceiling and an obligated purchase order are different things, so each amount
 *      carries the instrument kind and the field it came from. A portfolio total is withheld unless
 *      every contract in scope has a recorded amount, because a partial sum reads as a full one.
 *   3. **This is not the market radar.** `/contracts` is the portfolio L&P holds. The Intelligence
 *      Recompete Radar is work L&P does *not* hold. The two are never merged or counted together.
 *   4. **Nothing here acts.** Buckets, readiness and next actions are advisory. No function in this
 *      module renews, extends, exercises an option, approves, or submits. A person does that.
 *
 * Pure module: no React, no Supabase.
 */

import { observationTile, type ObservationTile } from "@/lib/intelligence/observations";

// --------------------------------------------------------------------------- routes and framing

export const PORTFOLIO_ROUTE = "/contracts";
export const RENEWALS_ROUTE = "/contracts/renewals";
export const COMPLIANCE_ROUTE = "/contracts/compliance";
export const MARKET_RADAR_ROUTE = "/intelligence/market";

export const PORTFOLIO_LABEL = "Contract portfolio — contracts L&P holds";
export const RENEWALS_LABEL = "Renewal & rebid command center";

export const PORTFOLIO_HONESTY_TEXT =
  "Verified contract instruments only. Status, buckets, expirations and next actions are read from contracts.verified_end_on and from dates recorded on option and renewal rows — never from a term length, a start date, or a typical cycle. A contract with no verified end date is shown as undated rather than assumed active.";

/**
 * The distinction that keeps `/contracts` and `/intelligence/market` from becoming the same list.
 * Rendered on the portfolio, the renewal queue and the per-contract renewal tab.
 */
export const LP_PORTFOLIO_VS_MARKET_RADAR_NOTE =
  "This is L&P's own awarded portfolio, not the Intelligence Market Recompete Radar. Two different concepts: (1) L&P renewals — contracts this org already holds, bucketed from verified_end_on on /contracts/renewals; (2) Market recompete radar — awards/contracts L&P does not hold on /intelligence/market. A contract on this page can never appear on the Market radar, and a Market radar row can never appear in the renewal queue. Automation never auto-creates pursuits from either list.";

export const MARKET_RADAR_CONTRAST_LABEL = "Not the Market Recompete Radar";

/** Options exist as labelled rows; exercised vs remaining is not a schema field. */
export const OPTION_NOT_ASSUMED_EXERCISED_NOTE =
  "Option rows are listed as recorded. Exercised vs remaining is not assumed — the schema has no exercised status, so remaining options read UNKNOWN rather than a guessed count.";

export type OptionsRemainingAssessment = {
  remaining: "UNKNOWN" | number;
  onFile: number;
  note: string;
};

/**
 * Remaining options are UNKNOWN unless the schema records exercised status.
 * Today `contract_options` has label + exercise_by only — never invent remaining.
 */
export function assessOptionsRemaining(options: { id: string; label: string; exercise_by?: string | null }[]): OptionsRemainingAssessment {
  const onFile = options.length;
  return {
    remaining: "UNKNOWN",
    onFile,
    note: OPTION_NOT_ASSUMED_EXERCISED_NOTE,
  };
}

/** Renewal owner/status are not columns on `contracts` — show UNKNOWN, never invent. */
export const RENEWAL_OWNER_STATUS_UNKNOWN_NOTE =
  "Renewal owner and renewal status are not columns on contracts. Displayed as UNKNOWN until the schema records them.";

// ------------------------------------------------------------------------------------- buckets

/** The six alert buckets `refresh_contract_alerts` computes. Ordered most urgent first. */
export const RENEWAL_BUCKETS = ["EXPIRED", "30", "60", "90", "120", "180"] as const;
export type RenewalBucket = (typeof RENEWAL_BUCKETS)[number];

export const RENEWAL_BUCKET_LABELS: Record<RenewalBucket, string> = {
  EXPIRED: "Expired",
  "30": "≤ 30 days",
  "60": "≤ 60 days",
  "90": "≤ 90 days",
  "120": "≤ 120 days",
  "180": "≤ 180 days",
};

export const RENEWAL_BUCKET_DEFINITION =
  "Buckets are computed by refresh_contract_alerts from (contracts.verified_end_on − current_date). A contract with no verified end date produces no bucket at all, so the queue under-reports rather than invents an expiration.";

export function isRenewalBucket(value: unknown): value is RenewalBucket {
  return typeof value === "string" && (RENEWAL_BUCKETS as readonly string[]).includes(value);
}

// -------------------------------------------------------------------------------------- status

export type ContractStatus = "EXPIRED" | RenewalBucket | "ACTIVE" | "UNKNOWN";

/** Derive display status from verified dates only — never invent end dates. */
export function deriveContractStatus(input: {
  verifiedEndOn: string | null;
  alertBucket: string | null;
  today?: string;
}): ContractStatus {
  if (!input.verifiedEndOn) return "UNKNOWN";
  if (input.alertBucket === "EXPIRED") return "EXPIRED";
  if (isRenewalBucket(input.alertBucket)) return input.alertBucket;
  if (input.verifiedEndOn < todayIso(input.today)) return "EXPIRED";
  return "ACTIVE";
}

function todayIso(today?: string): string {
  if (typeof today === "string" && today.length >= 10) return today.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------- lifecycle filters

/**
 * A partition, not a set of overlapping tags: every contract lands in exactly one lane, so the lane
 * counts always add up to the portfolio count and no row is unreachable from the filter bar.
 */
export const PORTFOLIO_FILTERS = [
  "ALL",
  "ACTIVE",
  "RENEWAL_REBID",
  "EXPIRING",
  "CLOSED",
  "UNDATED",
] as const;
export type PortfolioFilter = (typeof PORTFOLIO_FILTERS)[number];

export type ContractLifecycle = Exclude<PortfolioFilter, "ALL">;

export const PORTFOLIO_FILTER_LABELS: Record<PortfolioFilter, string> = {
  ALL: "All",
  ACTIVE: "Active",
  RENEWAL_REBID: "Renewal / rebid",
  EXPIRING: "Expiring",
  CLOSED: "Closed",
  UNDATED: "No verified end",
};

export const PORTFOLIO_FILTER_DEFINITIONS: Record<PortfolioFilter, string> = {
  ALL: "Every contract row in this tenant.",
  ACTIVE: "Verified end date in the future and no alert bucket — outside the 180-day window.",
  RENEWAL_REBID: "In the 180 or 120 day bucket: the renewal or rebid decision window is open.",
  EXPIRING: "In the 90, 60 or 30 day bucket: the decision is due now.",
  CLOSED: "Verified end date has passed (EXPIRED bucket). Kept on file, never deleted.",
  UNDATED: "No verified end date on file, so no bucket can be computed. Not assumed active.",
};

export function portfolioFilterFromParam(value: unknown): PortfolioFilter {
  if (typeof value !== "string") return "ALL";
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return (PORTFOLIO_FILTERS as readonly string[]).includes(normalized)
    ? (normalized as PortfolioFilter)
    : "ALL";
}

function lifecycleFor(status: ContractStatus): ContractLifecycle {
  if (status === "UNKNOWN") return "UNDATED";
  if (status === "EXPIRED") return "CLOSED";
  if (status === "180" || status === "120") return "RENEWAL_REBID";
  if (status === "90" || status === "60" || status === "30") return "EXPIRING";
  return "ACTIVE";
}

// --------------------------------------------------------------------------------------- risk

export type ContractRiskLevel = "OVERDUE" | "ACT_NOW" | "WATCH" | "NONE" | "UNKNOWN";

export const CONTRACT_RISK_LABELS: Record<ContractRiskLevel, string> = {
  OVERDUE: "Overdue",
  ACT_NOW: "Act now",
  WATCH: "Watch",
  NONE: "No dated obligation",
  UNKNOWN: "Unknown",
};

// ------------------------------------------------------------------------------------- values

/**
 * The two amount kinds this schema actually records. Neither is "contract value": an award ceiling
 * is what may be spent, an obligated purchase order is what has been. They are never added together.
 */
export type ContractValueKind = "NTE_CEILING" | "PO_OBLIGATED";

export const CONTRACT_VALUE_KIND_LABELS: Record<ContractValueKind, string> = {
  NTE_CEILING: "NTE ceiling (award)",
  PO_OBLIGATED: "Obligated (purchase orders)",
};

export const CONTRACT_VALUE_ABSENT_NOTE =
  "There is no contract-value column in this schema. Original value is the award NTE ceiling when an award records one; current value is the obligated total across recorded purchase orders. Amendments record no amount, so an amendment never changes a value here — the row stays a dash rather than inheriting the original.";

export type ContractValue = {
  amount: number;
  kind: ContractValueKind;
  /** Names the field the number came from so it can be checked against the instrument. */
  basis: string;
};

export type PortfolioValueTotal = {
  amount: number | null;
  kind: ContractValueKind | null;
  basis: string | null;
  /** How many contracts in scope have a recorded amount, out of how many are in scope. */
  covered: number;
  inScope: number;
  /** Non-null whenever `amount` is null. Always names the coverage gap. */
  withheldReason: string | null;
};

// -------------------------------------------------------------------------------- input shapes

export type PortfolioBuyer = { id: string; name: string };

export type PortfolioContract = {
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

export type PortfolioAlert = {
  contract_id: string;
  bucket: string;
  days_until: number | null;
  verified_end_on: string | null;
  computed_on?: string | null;
};

export type PortfolioOption = {
  id: string;
  contract_id: string;
  label: string;
  exercise_by: string | null;
  source_fact_id?: string | null;
};

export type PortfolioRenewalNotice = {
  id: string;
  contract_id: string;
  notice: string | null;
  notice_due_on: string | null;
  option_year: number | null;
  escalation_index?: string | null;
  escalation_pct?: number | null;
  source_fact_id?: string | null;
};

export type PortfolioAward = {
  id: string;
  opportunity_id: string | null;
  amount_nte: number | null;
  awarded_on: string | null;
  notice: string | null;
  winner_name?: string | null;
  source_fact_id: string | null;
  source_document_id: string | null;
};

export type PortfolioPurchaseOrder = {
  id: string;
  contract_id: string | null;
  po_number: string | null;
  issued_on: string | null;
  total_amount: number | null;
  source_fact_id?: string | null;
  source_document_id?: string | null;
};

export type PortfolioAmendment = {
  id: string;
  contract_id: string;
  amendment_number: string | null;
  title: string | null;
  note: string | null;
  effective_on: string | null;
  source_fact_id?: string | null;
  source_document_id?: string | null;
};

export type ContractPortfolioInput = {
  contracts?: PortfolioContract[];
  alerts?: PortfolioAlert[];
  options?: PortfolioOption[];
  renewalNotices?: PortfolioRenewalNotice[];
  awards?: PortfolioAward[];
  purchaseOrders?: PortfolioPurchaseOrder[];
  amendments?: PortfolioAmendment[];
  buyers?: PortfolioBuyer[];
  /** ISO date. Injected so the model is deterministic under test. */
  today?: string;
};

// ---------------------------------------------------------------------------------- row shapes

export type ContractSource = { label: string; href: string | null };

export type ContractNextAction = {
  /** What is due. Always restates a recorded date, or says none is recorded. */
  label: string;
  /** The soonest verified obligation date, or null when nothing is dated. */
  on: string | null;
  /** The field the date came from. */
  basis: string;
};

export type ContractPortfolioRow = {
  id: string;
  title: string;
  contractNumber: string | null;
  buyerId: string | null;
  buyerName: string | null;
  opportunityId: string | null;
  status: ContractStatus;
  lifecycle: ContractLifecycle;
  bucket: RenewalBucket | null;
  daysUntil: number | null;
  startOn: string | null;
  expirationOn: string | null;
  originalValue: ContractValue | null;
  currentValue: ContractValue | null;
  options: { label: string; exerciseBy: string | null }[];
  nextOptionExerciseBy: string | null;
  nextAction: ContractNextAction;
  risk: { level: ContractRiskLevel; note: string };
  sources: ContractSource[];
  /** Named gaps, rendered so an absent field reads as absent rather than as a zero. */
  missing: string[];
};

export type ContractPortfolio = {
  rows: ContractPortfolioRow[];
  counts: Record<PortfolioFilter, number>;
  buckets: Record<RenewalBucket, number>;
  /** Contracts with a verified end date in the future, whatever bucket they are in. */
  activeCount: number;
  /** Contracts with no verified end date — the honest denominator gap. */
  undatedCount: number;
  /** Contracts whose verified end date has passed. */
  expiredCount: number;
  activeContractValue: PortfolioValueTotal;
  /** Latest `contract_alerts.computed_on` seen, for the automation audit strip. */
  alertsComputedOn: string | null;
};

// ----------------------------------------------------------------------------------- utilities

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function earliest(dates: (string | null | undefined)[]): string | null {
  const present = dates.filter((d): d is string => typeof d === "string" && d.length > 0).sort();
  return present[0] ?? null;
}

function groupBy<T>(rows: T[], key: (row: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    const list = map.get(k) ?? [];
    list.push(row);
    map.set(k, list);
  }
  return map;
}

function verificationHref(documentId: string | null | undefined): string | null {
  return documentId ? `/ingestion/verification/${documentId}` : null;
}

/** Most urgent bucket wins: a contract can hold several alert rows at once. */
function mostUrgentBucket(alerts: PortfolioAlert[]): PortfolioAlert | null {
  let best: PortfolioAlert | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const alert of alerts) {
    if (!isRenewalBucket(alert.bucket)) continue;
    const rank = RENEWAL_BUCKETS.indexOf(alert.bucket);
    if (rank < bestRank) {
      bestRank = rank;
      best = alert;
    }
  }
  return best;
}

// ------------------------------------------------------------------------------- portfolio build

export function buildContractPortfolio(input: ContractPortfolioInput): ContractPortfolio {
  const today = todayIso(input.today);
  const contracts = input.contracts ?? [];
  const buyerName = new Map((input.buyers ?? []).map((b) => [b.id, b.name]));
  const alertsByContract = groupBy(input.alerts ?? [], (a) => a.contract_id);
  const optionsByContract = groupBy(input.options ?? [], (o) => o.contract_id);
  const noticesByContract = groupBy(input.renewalNotices ?? [], (n) => n.contract_id);
  const posByContract = groupBy(input.purchaseOrders ?? [], (p) => p.contract_id);
  const awardsByOpportunity = groupBy(input.awards ?? [], (a) => a.opportunity_id);

  let alertsComputedOn: string | null = null;
  for (const alert of input.alerts ?? []) {
    if (alert.computed_on && (!alertsComputedOn || alert.computed_on > alertsComputedOn)) {
      alertsComputedOn = alert.computed_on;
    }
  }

  const rows = contracts.map((contract) =>
    buildRow({
      contract,
      today,
      buyerName,
      alerts: alertsByContract.get(contract.id) ?? [],
      options: optionsByContract.get(contract.id) ?? [],
      notices: noticesByContract.get(contract.id) ?? [],
      purchaseOrders: posByContract.get(contract.id) ?? [],
      award: contract.opportunity_id
        ? ((awardsByOpportunity.get(contract.opportunity_id) ?? []).find((a) => a.amount_nte != null) ??
          (awardsByOpportunity.get(contract.opportunity_id) ?? [])[0] ??
          null)
        : null,
    }),
  );

  rows.sort(sortByUrgency);

  const counts = {
    ALL: rows.length,
    ACTIVE: rows.filter((r) => r.lifecycle === "ACTIVE").length,
    RENEWAL_REBID: rows.filter((r) => r.lifecycle === "RENEWAL_REBID").length,
    EXPIRING: rows.filter((r) => r.lifecycle === "EXPIRING").length,
    CLOSED: rows.filter((r) => r.lifecycle === "CLOSED").length,
    UNDATED: rows.filter((r) => r.lifecycle === "UNDATED").length,
  } satisfies Record<PortfolioFilter, number>;

  return {
    rows,
    counts,
    buckets: summarizeRenewalBuckets(rows),
    activeCount: counts.ACTIVE + counts.RENEWAL_REBID + counts.EXPIRING,
    undatedCount: counts.UNDATED,
    expiredCount: counts.CLOSED,
    activeContractValue: totalActiveContractValue(rows),
    alertsComputedOn,
  };
}

/** Soonest dated obligation first; undated rows last, then alphabetical so the order is stable. */
function sortByUrgency(a: ContractPortfolioRow, b: ContractPortfolioRow): number {
  const aOn = a.nextAction.on;
  const bOn = b.nextAction.on;
  if (aOn && bOn && aOn !== bOn) return aOn < bOn ? -1 : 1;
  if (aOn && !bOn) return -1;
  if (!aOn && bOn) return 1;
  return (
    (a.buyerName ?? "").localeCompare(b.buyerName ?? "") || a.title.localeCompare(b.title)
  );
}

function buildRow(args: {
  contract: PortfolioContract;
  today: string;
  buyerName: Map<string, string>;
  alerts: PortfolioAlert[];
  options: PortfolioOption[];
  notices: PortfolioRenewalNotice[];
  purchaseOrders: PortfolioPurchaseOrder[];
  award: PortfolioAward | null;
}): ContractPortfolioRow {
  const { contract, today, alerts, options, notices, purchaseOrders, award } = args;

  const alert = mostUrgentBucket(alerts);
  const status = deriveContractStatus({
    verifiedEndOn: contract.verified_end_on,
    alertBucket: alert?.bucket ?? null,
    today,
  });
  const lifecycle = lifecycleFor(status);
  const bucket = alert && isRenewalBucket(alert.bucket) ? alert.bucket : null;

  const optionRows = options.map((o) => ({ label: o.label, exerciseBy: o.exercise_by }));
  // An exercise-by date that has already passed is not a next action; it is history.
  const nextOptionExerciseBy = earliest(
    options.map((o) => o.exercise_by).filter((d) => d != null && d >= today),
  );
  const nextNoticeDueOn = earliest(
    notices.map((n) => n.notice_due_on).filter((d) => d != null && d >= today),
  );

  const originalValue = buildOriginalValue(award);
  const currentValue = buildCurrentValue(purchaseOrders);

  const nextAction = buildNextAction({
    status,
    daysUntil: alert?.days_until ?? null,
    expirationOn: contract.verified_end_on,
    nextOptionExerciseBy,
    nextNoticeDueOn,
    optionLabel:
      options.find((o) => o.exercise_by === nextOptionExerciseBy)?.label ?? null,
  });

  const sources: ContractSource[] = [];
  if (contract.source_document_id) {
    sources.push({
      label: `contract document ${contract.source_document_id.slice(0, 8)}`,
      href: verificationHref(contract.source_document_id),
    });
  } else if (contract.source_fact_id) {
    sources.push({ label: `contract fact ${contract.source_fact_id.slice(0, 8)}`, href: null });
  }
  if (award?.source_document_id) {
    sources.push({
      label: `award document ${award.source_document_id.slice(0, 8)}`,
      href: verificationHref(award.source_document_id),
    });
  } else if (award?.source_fact_id) {
    sources.push({ label: `award fact ${award.source_fact_id.slice(0, 8)}`, href: null });
  }

  const missing: string[] = [];
  if (!contract.verified_end_on) missing.push("verified end date");
  if (!contract.start_on) missing.push("start date");
  if (!originalValue) missing.push("original value");
  if (!currentValue) missing.push("current value");
  if (optionRows.length === 0) missing.push("options");
  if (sources.length === 0) missing.push("source");

  const buyerId = contract.client_id;

  return {
    id: contract.id,
    title: contract.title,
    contractNumber: contract.contract_number,
    buyerId,
    buyerName: buyerId ? (args.buyerName.get(buyerId) ?? null) : null,
    opportunityId: contract.opportunity_id,
    status,
    lifecycle,
    bucket,
    daysUntil: alert?.days_until ?? null,
    startOn: contract.start_on,
    expirationOn: contract.verified_end_on,
    originalValue,
    currentValue,
    options: optionRows,
    nextOptionExerciseBy,
    nextAction,
    risk: riskFor(status),
    sources,
    missing,
  };
}

function buildOriginalValue(award: PortfolioAward | null): ContractValue | null {
  const amount = num(award?.amount_nte);
  if (amount == null) return null;
  return {
    amount,
    kind: "NTE_CEILING",
    basis: "awards.amount_nte on the linked award — a ceiling, not a spend",
  };
}

function buildCurrentValue(purchaseOrders: PortfolioPurchaseOrder[]): ContractValue | null {
  const amounts = purchaseOrders.map((po) => num(po.total_amount)).filter((n): n is number => n != null);
  if (amounts.length === 0) return null;
  return {
    amount: amounts.reduce((sum, n) => sum + n, 0),
    kind: "PO_OBLIGATED",
    basis: `sum of purchase_orders.total_amount across ${amounts.length} recorded PO${amounts.length === 1 ? "" : "s"}`,
  };
}

function buildNextAction(args: {
  status: ContractStatus;
  daysUntil: number | null;
  expirationOn: string | null;
  nextOptionExerciseBy: string | null;
  nextNoticeDueOn: string | null;
  optionLabel: string | null;
}): ContractNextAction {
  const { status, daysUntil, expirationOn, nextOptionExerciseBy, nextNoticeDueOn, optionLabel } = args;

  if (status === "UNKNOWN") {
    return {
      label: "Verify an end date on a contract instrument — no bucket can be computed without one",
      on: null,
      basis: "contracts.verified_end_on is null",
    };
  }
  if (status === "EXPIRED") {
    return {
      label: `Expired ${expirationOn ?? ""} — close out or start a rebid pursuit`.trim(),
      on: expirationOn,
      basis: "contracts.verified_end_on (already passed)",
    };
  }

  // The soonest dated obligation wins, whichever instrument records it.
  const soonest = earliest([nextOptionExerciseBy, nextNoticeDueOn, expirationOn]);
  if (soonest && soonest === nextOptionExerciseBy) {
    return {
      label: `Option decision${optionLabel ? ` — ${optionLabel}` : ""} by ${soonest}`,
      on: soonest,
      basis: "contract_options.exercise_by (earliest unpassed)",
    };
  }
  if (soonest && soonest === nextNoticeDueOn) {
    return {
      label: `Renewal / termination notice due ${soonest}`,
      on: soonest,
      basis: "renewals.notice_due_on (earliest unpassed)",
    };
  }
  if (status === "30" || status === "60" || status === "90") {
    return {
      label: `Rebid decision due — ${daysUntil ?? "?"} days to verified end`,
      on: expirationOn,
      basis: "contract_alerts.days_until from contracts.verified_end_on",
    };
  }
  if (status === "120" || status === "180") {
    return {
      label: `Renewal / rebid window open — ${daysUntil ?? "?"} days to verified end`,
      on: expirationOn,
      basis: "contract_alerts.days_until from contracts.verified_end_on",
    };
  }
  return {
    label: "No dated obligation inside the 180-day window",
    on: expirationOn,
    basis: "contracts.verified_end_on, outside every alert bucket",
  };
}

function riskFor(status: ContractStatus): { level: ContractRiskLevel; note: string } {
  if (status === "UNKNOWN") {
    return { level: "UNKNOWN", note: "No verified end date — risk cannot be assessed, not assumed low." };
  }
  if (status === "EXPIRED") {
    return { level: "OVERDUE", note: "Verified end date has passed." };
  }
  if (status === "30" || status === "60") {
    return { level: "ACT_NOW", note: "Inside 60 days of the verified end date." };
  }
  if (status === "90" || status === "120" || status === "180") {
    return { level: "WATCH", note: "Inside the 180-day renewal window." };
  }
  return { level: "NONE", note: "Outside every alert bucket on the verified end date." };
}

export function filterPortfolioRows(
  rows: ContractPortfolioRow[],
  filter: PortfolioFilter,
): ContractPortfolioRow[] {
  if (filter === "ALL") return rows;
  return rows.filter((row) => row.lifecycle === filter);
}

export function summarizeRenewalBuckets(
  rows: Pick<ContractPortfolioRow, "bucket">[],
): Record<RenewalBucket, number> {
  const counts = Object.fromEntries(RENEWAL_BUCKETS.map((b) => [b, 0])) as Record<RenewalBucket, number>;
  for (const row of rows) {
    if (row.bucket) counts[row.bucket] += 1;
  }
  return counts;
}

/**
 * A portfolio total is only stated when every contract in scope carries a recorded amount.
 *
 * Summing the subset that happens to have an award NTE would print a number that looks like the
 * whole book of business and is not; the gate is the same one the win rate uses on Intelligence.
 */
export function totalActiveContractValue(rows: ContractPortfolioRow[]): PortfolioValueTotal {
  const inScopeRows = rows.filter((r) => r.lifecycle !== "CLOSED" && r.lifecycle !== "UNDATED");
  const withValue = inScopeRows.filter((r) => r.originalValue != null);
  const inScope = inScopeRows.length;
  const covered = withValue.length;

  if (inScope === 0 || covered < inScope) {
    return {
      amount: null,
      kind: null,
      basis: null,
      covered,
      inScope,
      withheldReason:
        inScope === 0
          ? "No active contract has a verified end date, so there is nothing in scope to value."
          : `Active Contract Value withheld: only ${covered} of ${inScope} active contracts record an award NTE ceiling. A partial sum would read as the whole portfolio. ${CONTRACT_VALUE_ABSENT_NOTE}`,
    };
  }

  return {
    amount: withValue.reduce((sum, r) => sum + (r.originalValue?.amount ?? 0), 0),
    kind: "NTE_CEILING",
    basis: `sum of awards.amount_nte across ${covered} active contracts — a ceiling total, not revenue`,
    covered,
    inScope,
    withheldReason: null,
  };
}

// ----------------------------------------------------------------------------------- KPI strip

/**
 * The portfolio KPI strip. Every tile carries `n=` and the table it was counted from, and no tile
 * states a value the corpus cannot support — the value tile is a separate, withheld-able statement.
 */
export function portfolioKpis(portfolio: ContractPortfolio): ObservationTile[] {
  const inWindow = portfolio.counts.RENEWAL_REBID + portfolio.counts.EXPIRING;
  return [
    observationTile({
      label: "Contracts on file",
      value: portfolio.counts.ALL,
      source: "contracts",
      unit: "contracts",
    }),
    observationTile({
      label: "Active (verified end ahead)",
      value: portfolio.activeCount,
      source: "contracts.verified_end_on",
      unit: "contracts",
    }),
    observationTile({
      label: "In renewal window",
      value: inWindow,
      source: "contract_alerts",
      href: RENEWALS_ROUTE,
      unit: "contracts",
    }),
    observationTile({
      label: "Expired on file",
      value: portfolio.expiredCount,
      source: "contract_alerts.EXPIRED",
      unit: "contracts",
    }),
    observationTile({
      label: "No verified end date",
      value: portfolio.undatedCount,
      source: "contracts with null verified_end_on",
      unit: "contracts",
    }),
  ];
}

// ------------------------------------------------------------------------------ change timeline

/**
 * Change kinds this view distinguishes. The classification reads the label recorded on the row — it
 * is not a legal determination and never changes the underlying record.
 */
export const CHANGE_TIMELINE_KINDS = [
  "ORIGINAL",
  "AMENDMENT",
  "MODIFICATION",
  "OPTION",
  "RENEWAL",
] as const;
export type ChangeTimelineKind = (typeof CHANGE_TIMELINE_KINDS)[number];

export const CHANGE_TIMELINE_KIND_LABELS: Record<ChangeTimelineKind, string> = {
  ORIGINAL: "Original award",
  AMENDMENT: "Amendment",
  MODIFICATION: "Modification",
  OPTION: "Option",
  RENEWAL: "Renewal / notice",
};

export const CHANGE_HISTORY_APPEND_ONLY_NOTE =
  "This timeline is append-only. A later amendment, modification, option or renewal is added as its own entry with its own source; it never overwrites, edits, or hides the entry before it. What the original instrument said stays readable after it is superseded.";

export type ChangeTimelineEntry = {
  key: string;
  kind: ChangeTimelineKind;
  label: string;
  /** Recorded effective date, or null when the instrument does not carry one. */
  on: string | null;
  detail: string | null;
  sources: ContractSource[];
  /** True when the instrument records no date, so it cannot be placed in sequence. */
  undated: boolean;
};

const MODIFICATION_RE = /\bmod(?:ification)?\b|\bchange order\b|\bP0{0,3}\d+\b/i;

export function buildChangeTimeline(input: {
  contract: Pick<PortfolioContract, "start_on" | "source_fact_id" | "source_document_id"> | null;
  award?: PortfolioAward | null;
  amendments?: PortfolioAmendment[];
  options?: PortfolioOption[];
  renewalNotices?: PortfolioRenewalNotice[];
}): ChangeTimelineEntry[] {
  const entries: ChangeTimelineEntry[] = [];

  const award = input.award ?? null;
  const contract = input.contract ?? null;
  if (contract || award) {
    const sources: ContractSource[] = [];
    if (award?.source_document_id) {
      sources.push({
        label: `award document ${award.source_document_id.slice(0, 8)}`,
        href: verificationHref(award.source_document_id),
      });
    }
    if (contract?.source_document_id) {
      sources.push({
        label: `contract document ${contract.source_document_id.slice(0, 8)}`,
        href: verificationHref(contract.source_document_id),
      });
    } else if (contract?.source_fact_id) {
      sources.push({ label: `contract fact ${contract.source_fact_id.slice(0, 8)}`, href: null });
    }
    const on = award?.awarded_on ?? contract?.start_on ?? null;
    entries.push({
      key: "original",
      kind: "ORIGINAL",
      label: award?.notice ? `Original award — ${award.notice}` : "Original award / contract start",
      on,
      detail:
        award?.amount_nte != null
          ? `NTE ceiling $${Number(award.amount_nte).toLocaleString()} (awards.amount_nte)`
          : null,
      sources,
      undated: on == null,
    });
  }

  for (const amendment of input.amendments ?? []) {
    const label = [amendment.amendment_number, amendment.title].filter(Boolean).join(" — ");
    const isMod = MODIFICATION_RE.test(`${amendment.amendment_number ?? ""} ${amendment.title ?? ""}`);
    const sources: ContractSource[] = [];
    if (amendment.source_document_id) {
      sources.push({
        label: `document ${amendment.source_document_id.slice(0, 8)}`,
        href: verificationHref(amendment.source_document_id),
      });
    } else if (amendment.source_fact_id) {
      sources.push({ label: `fact ${amendment.source_fact_id.slice(0, 8)}`, href: null });
    }
    entries.push({
      key: `amendment:${amendment.id}`,
      kind: isMod ? "MODIFICATION" : "AMENDMENT",
      label: label || "Amendment on file",
      on: amendment.effective_on,
      detail: amendment.note,
      sources,
      undated: amendment.effective_on == null,
    });
  }

  for (const option of input.options ?? []) {
    entries.push({
      key: `option:${option.id}`,
      kind: "OPTION",
      label: option.label,
      on: option.exercise_by,
      detail: option.exercise_by
        ? `Exercise by ${option.exercise_by} — exercised vs remaining is not recorded and is not assumed`
        : "No exercise-by date recorded — exercised vs remaining is not assumed",
      sources: option.source_fact_id
        ? [{ label: `fact ${option.source_fact_id.slice(0, 8)}`, href: null }]
        : [],
      undated: option.exercise_by == null,
    });
  }

  for (const notice of input.renewalNotices ?? []) {
    const bits = [
      notice.option_year != null ? `option year ${notice.option_year}` : null,
      notice.escalation_index ? `index ${notice.escalation_index}` : null,
      notice.escalation_pct != null ? `${notice.escalation_pct}%` : null,
    ].filter(Boolean);
    entries.push({
      key: `renewal:${notice.id}`,
      kind: "RENEWAL",
      label: notice.notice ?? "Renewal / termination notice",
      on: notice.notice_due_on,
      detail: bits.length > 0 ? bits.join(" · ") : null,
      sources: notice.source_fact_id
        ? [{ label: `fact ${notice.source_fact_id.slice(0, 8)}`, href: null }]
        : [],
      undated: notice.notice_due_on == null,
    });
  }

  // Chronological, undated instruments last — an instrument with no date is not silently placed.
  entries.sort((a, b) => {
    if (a.on && b.on && a.on !== b.on) return a.on < b.on ? -1 : 1;
    if (a.on && !b.on) return -1;
    if (!a.on && b.on) return 1;
    return CHANGE_TIMELINE_KINDS.indexOf(a.kind) - CHANGE_TIMELINE_KINDS.indexOf(b.kind);
  });
  return entries;
}

// -------------------------------------------------------------------------- commercial precedence

/**
 * The order in which recorded instruments speak, most recent instrument last. This is a reading
 * order for the operator, not an automatic overwrite: nothing in the app rewrites an earlier term
 * because a later instrument exists, and a term absent from every instrument stays absent.
 */
export const COMMERCIAL_PRECEDENCE = [
  "Original contract / award instrument",
  "Amendment or modification on file",
  "Exercised option year",
  "Renewal notice with escalation on file",
  "Purchase order actually issued",
] as const;

export const COMMERCIAL_PRECEDENCE_NOTE =
  "Precedence is a reading order, not an automatic overwrite. A later instrument does not silently replace an earlier term in this app: both stay on the Changes timeline with their own sources, and a term that no instrument records is shown as absent rather than carried forward from the original.";

export const FOUR_COMMERCIAL_TRUTHS = [
  "requested (buyer)",
  "submitted (L&P)",
  "awarded (buyer)",
  "current / amended",
] as const;

export const FOUR_TRUTHS_NOTE =
  "The four commercial truths stay in four columns and are never merged into one price. Internal cost is a planning column, not a commercial truth. On a contract, current / amended is only populated from a verified amending instrument — it never defaults to the awarded value.";

// ------------------------------------------------------------------- rebid readiness (advisory)

export const REBID_CTA_LABEL = "Start Rebid Pursuit";

export const REBID_CTA_NOTE =
  "Creates a new pursuit workspace in INTAKE linked back to this contract (rebid_from_contract_id and rebid_from_opportunity_id). It carries over the buyer, the service type and a provenance note only — no pricing is copied, because prior rates were priced against a prior solicitation and must be re-verified.";

/** Explicit operator-facing guarantee: Start Rebid never promotes prior commercial terms. */
export const REBID_NO_PRICING_OR_REQUIREMENTS_COPY =
  "Pricing and requirements are not copied as new truth. Prior rates, line items, award amounts, and requirement matrices stay on the historical records linked below — they must be re-verified against the new solicitation.";

export const NO_AUTO_ACTION_NOTE =
  "Nothing on this page renews, extends, exercises an option, approves, or submits. Alerts and readiness are advisory; every renewal and rebid decision is taken by a person. Alert automation upserts contract_alerts only and never creates pursuits.";

/** Alert dedupe: one row per (org, contract, bucket) — refresh upserts, it does not insert daily duplicates. */
export const ALERT_DEDUPE_UNIQUE_KEY = "(organization_id, contract_id, bucket)";

export const ALERT_DEDUPE_NOTE =
  "contract_alerts is unique on (organization_id, contract_id, bucket). refresh_contract_alerts upserts on that key and deletes stale buckets — there is no daily duplicate row per contract, and no alert_events / last_notified_at table in this schema.";

export type RebidReadinessLevel = "REVIEW_REQUIRED" | "NO_EXPIRED_ITEMS" | "UNKNOWN";

export type RebidReadiness = {
  level: RebidReadinessLevel;
  headline: string;
  expired: { id: string; kind: string; statement: string; expires_on: string | null }[];
  expiringSoon: { id: string; kind: string; statement: string; expires_on: string | null }[];
  undated: { id: string; kind: string; statement: string; expires_on: string | null }[];
  note: string;
};

export type ReadinessComplianceItem = {
  id: string;
  kind: string;
  statement: string;
  expires_on: string | null;
};

export const READINESS_ADVISORY_NOTE =
  "Advisory only. This reads compliance_items already on file (including F12 mirrored SAM registration rows for F9 expiry). It does not certify eligibility, does not gate the rebid button, and an empty list means nothing has been recorded — not that the requirement does not exist. When requirement_compliance_matches exist on a pursuit, Overview prefers that match rollup.";

/** Days ahead that count as "expiring soon" for a rebid readiness read. */
export const READINESS_HORIZON_DAYS = 90;

export function assessRebidReadiness(input: {
  compliance?: ReadinessComplianceItem[];
  today?: string;
  horizonDays?: number;
}): RebidReadiness {
  const today = todayIso(input.today);
  const horizon = addDays(today, input.horizonDays ?? READINESS_HORIZON_DAYS);
  const items = input.compliance ?? [];

  const expired = items.filter((i) => i.expires_on != null && i.expires_on < today);
  const expiringSoon = items.filter(
    (i) => i.expires_on != null && i.expires_on >= today && i.expires_on <= horizon,
  );
  const undated = items.filter((i) => i.expires_on == null);

  if (items.length === 0) {
    return {
      level: "UNKNOWN",
      headline: "No compliance items on file — readiness unknown, not clear",
      expired,
      expiringSoon,
      undated,
      note: READINESS_ADVISORY_NOTE,
    };
  }
  if (expired.length > 0) {
    return {
      level: "REVIEW_REQUIRED",
      headline: `${expired.length} compliance item${expired.length === 1 ? "" : "s"} expired — review before rebid`,
      expired,
      expiringSoon,
      undated,
      note: READINESS_ADVISORY_NOTE,
    };
  }
  return {
    level: "NO_EXPIRED_ITEMS",
    headline: `No expired compliance items among the ${items.length} on file${
      expiringSoon.length > 0 ? ` · ${expiringSoon.length} expiring within ${input.horizonDays ?? READINESS_HORIZON_DAYS} days` : ""
    }`,
    expired,
    expiringSoon,
    undated,
    note: READINESS_ADVISORY_NOTE,
  };
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------- automation audit

export const ALERT_CRON_JOB = "refresh-contract-alerts";
export const ALERT_CRON_SCHEDULE = "15 6 * * * (06:15 UTC daily)";

export const AUTOMATION_SCOPE_NOTE =
  "refresh_contract_alerts recomputes bucket rows from (contracts.verified_end_on − current_date) and deletes stale ones. That is its entire scope: it writes no contract term, exercises no option, sends no notice, and approves nothing.";

export type AutomationAudit = {
  job: string;
  schedule: string;
  /** Latest `contract_alerts.computed_on`, or null when no alert row exists yet. */
  lastRefreshAt: string | null;
  lastRefreshLabel: string;
  onLoadNote: string;
  scopeNote: string;
  guarantee: string;
};

export function automationAudit(input: {
  alertsComputedOn: string | null;
  refreshedOnLoad?: boolean;
}): AutomationAudit {
  return {
    job: ALERT_CRON_JOB,
    schedule: ALERT_CRON_SCHEDULE,
    lastRefreshAt: input.alertsComputedOn,
    lastRefreshLabel: input.alertsComputedOn
      ? `Buckets last computed ${input.alertsComputedOn}`
      : "No alert row has been computed yet — no contract carries a verified end date",
    onLoadNote:
      input.refreshedOnLoad === false
        ? "Not refreshed on this view; buckets are read as last computed."
        : "refresh_contract_alerts() was called on load of this view, under the caller's RLS.",
    scopeNote: AUTOMATION_SCOPE_NOTE,
    guarantee: NO_AUTO_ACTION_NOTE,
  };
}
