import type { GoNoGo, PricingCostModelRow } from "./types";
import { computePlannedRate, parseNum } from "./pricing-math";

export type ProcurementRail =
  | "COMMERCIAL_QUOTE"
  | "TX_MUNICIPAL_ISD"
  | "TXMAS"
  | "GSA_FEDERAL"
  | "OTHER_GOV";

export type SolicitationKind = "QUOTE" | "RFQ" | "RFP" | "IFB" | "TASK_ORDER" | "REBID";

export const PROCUREMENT_RAILS: { value: ProcurementRail; label: string; hint: string }[] = [
  {
    value: "COMMERCIAL_QUOTE",
    label: "Commercial quote",
    hint: "Private buyer: site hours, armed/unarmed, start date, insurance. Typical LPGS web-quote path.",
  },
  {
    value: "TX_MUNICIPAL_ISD",
    label: "TX city / county / ISD",
    hint: "ESBD or local portal RFP/RFQ/IFB. Capture eval criteria, addenda, bid forms.",
  },
  {
    value: "TXMAS",
    label: "TXMAS / TxSmartBuy",
    hint: "LPGS listed vehicle TXMAS-24-99003 (Guard and Security Services) through 8/29/2027 — enter in vehicle ref if this pursuit uses it.",
  },
  {
    value: "GSA_FEDERAL",
    label: "GSA / federal",
    hint: "MAS vehicle (PoP through 8/29/2027). Task orders need labor cats + any SCA wage determination from the solicitation.",
  },
  {
    value: "OTHER_GOV",
    label: "Other government",
    hint: "State/federal path that is not TXMAS or GSA MAS. Record vehicle in notes/vehicle ref.",
  },
];

export const SOLICITATION_KINDS: { value: SolicitationKind; label: string }[] = [
  { value: "QUOTE", label: "Commercial quote" },
  { value: "RFQ", label: "RFQ" },
  { value: "RFP", label: "RFP" },
  { value: "IFB", label: "IFB / invitation for bid" },
  { value: "TASK_ORDER", label: "Task order (GSA/TXMAS)" },
  { value: "REBID", label: "Rebid / renewal competition" },
];

export type PacketInput = {
  clientName: string | null;
  procurementRail: ProcurementRail | null;
  solicitationKind: SolicitationKind | null;
  responseDueOn: string | null;
  serviceType: string | null;
  siteLocation: string | null;
  submissionMethod: string | null;
  coverageStartOn: string | null;
  vehicleRef: string | null;
  goNoGo: GoNoGo;
  documentCount: number;
  requirementCount: number;
  evaluationCount: number;
  staffingCount: number;
  staffingHoursEntered: boolean;
  pricingLineCount: number;
  costModelCount: number;
  competitorBidCount: number;
  hasWinLoss: boolean;
};

export type PacketGap = {
  id: string;
  label: string;
  hrefSuffix: string;
  severity: "block" | "warn";
};

/** Deterministic missing-info list. Never fills values. */
export function listProposalPacketGaps(input: PacketInput): PacketGap[] {
  const gaps: PacketGap[] = [];
  const formal = input.solicitationKind === "RFP" || input.solicitationKind === "IFB" || input.solicitationKind === "RFQ";
  const vehicleRail = input.procurementRail === "TXMAS" || input.procurementRail === "GSA_FEDERAL";

  const add = (id: string, label: string, hrefSuffix: string, severity: "block" | "warn" = "block") => {
    gaps.push({ id, label, hrefSuffix, severity });
  };

  if (!input.clientName) add("buyer", "Buyer / agency not linked", "");
  if (!input.procurementRail) add("rail", "Procurement rail not set (quote vs TXMAS vs GSA vs municipal)", "");
  if (!input.solicitationKind) add("kind", "Solicitation kind not set (quote / RFP / RFQ / IFB / task order / rebid)", "");
  if (!input.serviceType) add("service", "Service type not set (armed, unarmed, patrol, EP, event, …)", "");
  if (!input.siteLocation) add("site", "Site / coverage location not entered", "");
  if (!input.responseDueOn) add("due", "Response due date not entered", "", "warn");
  if (!input.submissionMethod && formal) add("submit", "Submission method not entered", "", "warn");
  if (vehicleRail && !input.vehicleRef) {
    add("vehicle", "Contract vehicle reference not entered (do not assume TXMAS-24-99003 or GSA MAS)", "", "warn");
  }
  if (input.documentCount === 0) add("docs", "No solicitation / quote documents ingested", "/submission");
  if (formal && input.requirementCount === 0) {
    add("reqs", "No verified requirements captured", "/requirements");
  }
  if (formal && input.evaluationCount === 0) {
    add("eval", "No evaluation criteria captured (Section M / bid factors)", "/requirements", "warn");
  }
  if (input.staffingCount === 0) add("staff", "No staffing post orders", "/staffing");
  if (input.staffingCount > 0 && !input.staffingHoursEntered) {
    add("hours", "Staffing rows exist but weekly hours are blank — cannot price fulfillment", "/staffing");
  }
  if (input.pricingLineCount === 0 && input.costModelCount === 0) {
    add("price", "No verified pricing lines and no planning cost model", "/pricing");
  }
  if (input.goNoGo === "PENDING" && (formal || input.procurementRail === "GSA_FEDERAL")) {
    add("gng", "Go / no-go still pending", "", "warn");
  }
  return gaps;
}

export type StaffingForEconomics = {
  post_label: string;
  weekly_hours: number | null;
  labor_category: string | null;
};

export type FulfillmentEconomics = {
  status: "complete" | "partial" | "blocked";
  weeklyHours: number | null;
  weeklyCost: number | null;
  weeklyRevenue: number | null;
  weeklyMargin: number | null;
  marginPct: number | null;
  unmatchedPosts: string[];
  notes: string[];
};

/**
 * Weekly fulfillment math from entered staffing hours × entered cost model.
 * Does not invent wages, hours, or category matches.
 */
export function computeFulfillmentEconomics(
  posts: StaffingForEconomics[],
  models: PricingCostModelRow[],
): FulfillmentEconomics {
  const notes: string[] = ["Planning only — not canonical proposed_rate or awarded dollars."];
  const modelByCat = new Map(models.map((m) => [m.labor_category.trim().toLowerCase(), m]));
  const hoursEntered = posts.filter((p) => p.weekly_hours != null && Number(p.weekly_hours) > 0);

  if (hoursEntered.length === 0) {
    return {
      status: "blocked",
      weeklyHours: null,
      weeklyCost: null,
      weeklyRevenue: null,
      weeklyMargin: null,
      marginPct: null,
      unmatchedPosts: posts.map((p) => p.post_label),
      notes: [...notes, "Enter weekly hours on staffing posts before a fulfillment rollup can run."],
    };
  }

  if (models.length === 0) {
    const weeklyHours = hoursEntered.reduce((s, p) => s + Number(p.weekly_hours), 0);
    return {
      status: "blocked",
      weeklyHours,
      weeklyCost: null,
      weeklyRevenue: null,
      weeklyMargin: null,
      marginPct: null,
      unmatchedPosts: hoursEntered.map((p) => p.post_label),
      notes: [...notes, "Save a planning cost model (actual wage/burden inputs) before margin can be calculated."],
    };
  }

  let weeklyHours = 0;
  let weeklyCost = 0;
  let weeklyRevenue = 0;
  const unmatchedPosts: string[] = [];
  const singleModel = models.length === 1 ? models[0] : null;

  for (const post of hoursEntered) {
    const hours = Number(post.weekly_hours);
    weeklyHours += hours;
    const key = post.labor_category?.trim().toLowerCase() ?? "";
    const matched = key ? modelByCat.get(key) : singleModel && !post.labor_category ? singleModel : undefined;
    if (!matched || matched.base_wage == null) {
      unmatchedPosts.push(post.post_label);
      if (matched && matched.base_wage == null) {
        notes.push(`Cost model “${matched.labor_category}” has no base wage — that post is excluded.`);
      }
      continue;
    }
    const result = computePlannedRate({
      baseWage: parseNum(matched.base_wage),
      fringe: parseNum(matched.fringe),
      healthWelfare: parseNum(matched.health_welfare),
      burdenPct: parseNum(matched.burden_pct),
      workersComp: parseNum(matched.workers_comp),
      insurance: parseNum(matched.insurance),
      supervision: parseNum(matched.supervision),
      equipment: parseNum(matched.equipment),
      vehicles: parseNum(matched.vehicles),
      travel: parseNum(matched.travel),
      overheadPct: parseNum(matched.overhead_pct),
      targetMarginPct: parseNum(matched.target_margin_pct),
    });
    weeklyCost += result.loadedCost * hours;
    weeklyRevenue += result.plannedRate * hours;
  }

  if (singleModel && hoursEntered.some((p) => !p.labor_category)) {
    notes.push(`Applied the only cost model (“${singleModel.labor_category}”) to posts without a labor category.`);
  }

  if (unmatchedPosts.length > 0) {
    notes.push("Unmatched posts excluded from dollars. Set labor category on the post to match a cost model name.");
  }

  const weeklyMargin = unmatchedPosts.length === hoursEntered.length ? null : weeklyRevenue - weeklyCost;
  const marginPct =
    weeklyMargin != null && weeklyRevenue > 0 ? (weeklyMargin / weeklyRevenue) * 100 : null;

  return {
    status: unmatchedPosts.length === 0 ? "complete" : weeklyMargin != null ? "partial" : "blocked",
    weeklyHours,
    weeklyCost: weeklyMargin == null ? null : weeklyCost,
    weeklyRevenue: weeklyMargin == null ? null : weeklyRevenue,
    weeklyMargin,
    marginPct,
    unmatchedPosts,
    notes,
  };
}
