/**
 * F4 research plan — deterministic subquestion templates.
 * Optional LLM planning can replace this later; templates are enough for F4.
 * Deterministic templates only — no durable agent graph. No second chatbot.
 */

export type ResearchType =
  | "BUYER"
  | "COMPETITOR"
  | "MARKET"
  | "PURSUIT"
  | "RECOMPETE"
  | "PRICING_CONTEXT";

export type ResearchProviderHint = "web" | "usa_spending" | "both";

export type ResearchSubquestion = {
  id: string;
  text: string;
  provider_hint: ResearchProviderHint;
};

export type ResearchPlan = {
  research_type: ResearchType;
  seed_query: string;
  entity_name: string | null;
  subquestions: ResearchSubquestion[];
};

export type ResearchPlanSeed = {
  query: string;
  entityName?: string | null;
  clientId?: string | null;
  competitorId?: string | null;
  opportunityId?: string | null;
  contractId?: string | null;
};

const TYPES: ResearchType[] = [
  "BUYER",
  "COMPETITOR",
  "MARKET",
  "PURSUIT",
  "RECOMPETE",
  "PRICING_CONTEXT",
];

export function isResearchType(value: string): value is ResearchType {
  return (TYPES as string[]).includes(value);
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function q(id: string, text: string, provider_hint: ResearchProviderHint): ResearchSubquestion {
  return { id, text, provider_hint };
}

/**
 * Build a bounded subquestion plan from research type + seed query/entity.
 * Pure and deterministic — same inputs ⇒ same plan.
 */
export function buildResearchPlan(type: ResearchType, seed: ResearchPlanSeed): ResearchPlan {
  const seed_query = seed.query.trim();
  if (!seed_query) throw new Error("Research query is required.");
  if (!isResearchType(type)) throw new Error(`Unknown research type: ${type}`);

  const entity = (seed.entityName ?? "").trim() || null;
  const subject = entity ?? seed_query;
  const prefix = `${type.toLowerCase()}-${slug(subject) || "q"}`;

  let subquestions: ResearchSubquestion[];

  switch (type) {
    case "BUYER":
      subquestions = [
        q(`${prefix}-profile`, `Official profile and procurement page for buyer "${subject}"`, "web"),
        q(`${prefix}-solicitations`, `Recent solicitations RFPs RFQs issued by "${subject}"`, "web"),
        q(`${prefix}-federal`, `Federal awards involving agency or recipient "${subject}"`, "usa_spending"),
        q(`${prefix}-incumbent`, `Incumbent contractor or current award for "${subject}" security or guard services`, "both"),
      ];
      break;
    case "COMPETITOR":
      subquestions = [
        q(`${prefix}-identity`, `Company overview and service lines for competitor "${subject}"`, "web"),
        q(`${prefix}-awards`, `Public contract awards won by "${subject}"`, "both"),
        q(`${prefix}-federal`, `USAspending awards to recipient "${subject}"`, "usa_spending"),
        q(`${prefix}-pricing`, `Published rates or pricing disclosures for "${subject}" (cite-only, not L&P truth)`, "web"),
      ];
      break;
    case "MARKET":
      subquestions = [
        q(`${prefix}-landscape`, `Market landscape for "${subject}" public-sector security services`, "web"),
        q(`${prefix}-naics`, `Federal spending NAICS 561612 or related for "${subject}"`, "usa_spending"),
        q(`${prefix}-trends`, `Recent procurement trends notices for "${subject}"`, "web"),
      ];
      break;
    case "PURSUIT":
      subquestions = [
        q(`${prefix}-notice`, `Solicitation notice and amendments for "${subject}"`, "web"),
        q(`${prefix}-buyer`, `Buyer evaluation criteria and past awards related to "${subject}"`, "web"),
        q(`${prefix}-federal`, `Related federal awards or vehicles for "${subject}"`, "usa_spending"),
      ];
      break;
    case "RECOMPETE":
      subquestions = [
        q(`${prefix}-incumbent`, `Incumbent and current contract term for recompete "${subject}"`, "web"),
        q(`${prefix}-expiry`, `Contract expiration option years recompete timeline for "${subject}"`, "web"),
        q(`${prefix}-federal`, `USAspending award history for recompete "${subject}"`, "usa_spending"),
      ];
      break;
    case "PRICING_CONTEXT":
      subquestions = [
        q(`${prefix}-public-rates`, `Publicly posted labor rates or wage determinations for "${subject}"`, "web"),
        q(`${prefix}-awards`, `Award amounts for comparable awards "${subject}" (public observation only)`, "both"),
        q(
          `${prefix}-federal`,
          `USAspending award amounts for "${subject}" — not L&P proposed/awarded/current pricing`,
          "usa_spending",
        ),
      ];
      break;
  }

  return {
    research_type: type,
    seed_query,
    entity_name: entity,
    subquestions,
  };
}
