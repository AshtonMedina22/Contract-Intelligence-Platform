/**
 * Contextual launch into the existing Find or Ask GPT surface.
 *
 * This module builds hrefs. It does not retrieve, synthesize, rank, or answer anything, and it is
 * deliberately the only way an Intelligence view reaches Ask, so there is exactly one Ask backend
 * and one Ask page. Filters travel as a display-only `context` string: the banner on the Ask page
 * states which view and which filters produced the question, and says plainly that the context did
 * not narrow retrieval.
 */

import {
  defaultPurposeForMode,
  purposeFromParam,
  type AskMode,
  type RetrievalPurpose,
} from "@/lib/retrieval/purpose";

export const ASK_LAUNCH_PATH = "/intelligence/ask";

/** Reserved query keys the Ask page already reads. `from` / `context` are provenance only. */
export const ASK_LAUNCH_PARAMS = [
  "mode",
  "purpose",
  "q",
  "opportunity",
  "report",
  "from",
  "context",
] as const;

export const ASK_CONTEXT_PAIR_SEPARATOR = "; ";
export const ASK_CONTEXT_KV_SEPARATOR = "=";

/** Every Intelligence secondary view that may launch Ask, by its route slug. */
export const ASK_LAUNCH_VIEWS = {
  market: "Intelligence · Market",
  clients: "Intelligence · Buyers",
  competitors: "Intelligence · Competitors",
  pricing: "Intelligence · Pricing",
  "win-loss": "Intelligence · Win/Loss",
  content: "Intelligence · Content",
  reports: "Intelligence · Reports",
} as const;

export type AskLaunchView = keyof typeof ASK_LAUNCH_VIEWS;

export type AskLaunchFilters = Record<string, string | number | null | undefined>;

export type AskLaunchInput = {
  mode: AskMode;
  purpose?: RetrievalPurpose | string | null;
  q?: string | null;
  opportunityId?: string | null;
  report?: string | null;
  from?: AskLaunchView | null;
  filters?: AskLaunchFilters | null;
};

function cleanText(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

/**
 * Serializes filters into one readable, auditable string. Sorted by key so the same view state
 * always produces the same href, which keeps the acceptance test and the browser URL stable.
 */
export function serializeAskContext(filters: AskLaunchFilters | null | undefined): string | null {
  if (!filters) return null;
  const pairs: string[] = [];
  for (const key of Object.keys(filters).sort()) {
    const value = cleanText(filters[key]);
    const label = cleanText(key);
    if (!value || !label) continue;
    pairs.push(`${label}${ASK_CONTEXT_KV_SEPARATOR}${value}`);
  }
  return pairs.length > 0 ? pairs.join(ASK_CONTEXT_PAIR_SEPARATOR) : null;
}

export function parseAskContext(raw: string | null | undefined): { key: string; value: string }[] {
  const text = cleanText(raw);
  if (!text) return [];
  return text
    .split(ASK_CONTEXT_PAIR_SEPARATOR)
    .map((pair) => {
      const at = pair.indexOf(ASK_CONTEXT_KV_SEPARATOR);
      if (at < 0) return { key: pair.trim(), value: "" };
      return { key: pair.slice(0, at).trim(), value: pair.slice(at + 1).trim() };
    })
    .filter((pair) => pair.key.length > 0);
}

export function askLaunchViewFromParam(raw: string | null | undefined): AskLaunchView | null {
  const text = cleanText(raw);
  if (!text) return null;
  return Object.hasOwn(ASK_LAUNCH_VIEWS, text) ? (text as AskLaunchView) : null;
}

export function askLaunchViewLabel(view: AskLaunchView | null): string | null {
  return view ? ASK_LAUNCH_VIEWS[view] : null;
}

/**
 * The one href builder for every "Ask about this" chip.
 *
 * An unrecognised purpose falls back to the mode default rather than travelling to the Ask page as
 * a bogus value, so a chip can never widen retrieval past a purpose the model knows.
 */
export function buildAskHref(input: AskLaunchInput): string {
  const purpose = purposeFromParam(input.purpose ?? null);
  const params = new URLSearchParams();
  params.set("mode", input.mode);
  params.set("purpose", purpose ?? defaultPurposeForMode(input.mode));

  const q = cleanText(input.q);
  if (q) params.set("q", q);

  const opportunityId = cleanText(input.opportunityId);
  if (opportunityId) params.set("opportunity", opportunityId);

  const report = cleanText(input.report);
  if (report) params.set("report", report);

  const from = input.from ? askLaunchViewFromParam(input.from) : null;
  if (from) params.set("from", from);

  const context = serializeAskContext(input.filters);
  if (context) params.set("context", context);

  return `${ASK_LAUNCH_PATH}?${params.toString()}`;
}

/** The purpose each Intelligence view asks with, so a chip cannot pick an unrelated purpose. */
export const ASK_CHIP_PURPOSE: Record<AskLaunchView, RetrievalPurpose> = {
  market: "REPORT_GENERATION",
  clients: "GENERAL_QA",
  competitors: "COMPETITOR_ANALYSIS",
  pricing: "PRICING_ANALYSIS",
  "win-loss": "LOSS_ANALYSIS",
  content: "LOCATE",
  reports: "REPORT_GENERATION",
};

export type AskChip = {
  label: string;
  href: string;
  /** Stated on hover so an operator knows which retrieval purpose they are about to use. */
  title: string;
};

export function askChip(input: AskLaunchInput & { label: string }): AskChip {
  const purpose =
    purposeFromParam(input.purpose ?? null) ??
    (input.from ? ASK_CHIP_PURPOSE[input.from] : null) ??
    defaultPurposeForMode(input.mode);
  return {
    label: input.label,
    href: buildAskHref({ ...input, purpose }),
    title: `Ask (${input.mode.toUpperCase()} · purpose=${purpose}) — retrieval stays purpose-scoped and evidence-only`,
  };
}

export const ASK_LAUNCH_NOTE =
  "Ask chips open the existing Find or Ask GPT surface with a mode and purpose already set. There is no second chatbot and no second research engine; the filters you see travel as displayed context only and do not narrow retrieval.";
