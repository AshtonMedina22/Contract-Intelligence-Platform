/**
 * F23 conservative corpus-role + authority classification.
 * Ambiguous → COMPETITOR_EVIDENCE or BUYER_HISTORY — never L_AND_P_DIRECT unless clear L&P.
 */

import {
  DOWNLOADABLE_EXT_RE,
  LP_NAME_RE,
  type AcquisitionCorpusRole,
  type SourceAuthority,
} from "./types";

const OFFICIAL_HOST_RE =
  /\.(gov|texas\.gov|tx\.us|us)$|ftp\.txdmv\.gov|data\.texas\.gov|sam\.gov|usaspending\.gov|gsaelibrary\.gsa\.gov|txsmartbuy\.gov|comptroller\.texas\.gov|dps\.texas\.gov|tops\.portal\.texas\.gov|jeffersoncountytx\.gov|destinyhosted\.com|granicus\.com|thrillshare\.com|diligentoneplatform\.com/i;

const BID_TAB_RE = /\bbid\s*tab|\btabulation\b|\btab\b/i;
const BOARD_PACKET_RE = /\bboard\s*(packet|agenda|minutes|meeting)\b|\bagenda_file\b/i;
const CONTRACT_PO_RE =
  /\bpurchase\s*order\b|\b\bPO\b[#\s]|\bservices?\s+contract\b|\bagreement\b|\bproposal\b/i;
const LICENSE_RE = /\blicen[cs]e\b|\bdisciplinary\b|\btops\b|\bpsb\b/i;
const REFERENCE_API_RE = /api\.usaspending\.gov|api\.sam\.gov|soda\.|data\.texas\.gov/i;

export type ClassifyInput = {
  url: string;
  title?: string | null;
  buyerName?: string | null;
  bodyHint?: string | null;
  /** When true (e.g. USAspending award row), force REFERENCE_DATA. */
  structuredReference?: boolean;
  /** Explicit competitor award/tab with no L&P. */
  competitorEvidence?: boolean;
};

export type ClassifyResult = {
  corpusRole: AcquisitionCorpusRole;
  sourceAuthority: SourceAuthority;
  reason: string;
};

function haystack(input: ClassifyInput): string {
  return [input.url, input.title ?? "", input.buyerName ?? "", input.bodyHint ?? ""]
    .join(" ")
    .trim();
}

function hostLooksOfficial(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return OFFICIAL_HOST_RE.test(host) || host.endsWith(".gov");
  } catch {
    return false;
  }
}

/**
 * Conservative role classifier. Clear L&P + contract/PO/proposal → L_AND_P_DIRECT.
 * Board packets / agendas mentioning L&P → BUYER_HISTORY (tied, not direct instrument).
 * Bid tabs without L&P → COMPETITOR_EVIDENCE. Ambiguous security docs → COMPARABLE_SECURITY or COMPETITOR_EVIDENCE.
 */
export function classifyCorpusRole(input: ClassifyInput): ClassifyResult {
  if (input.structuredReference) {
    return {
      corpusRole: "REFERENCE_DATA",
      sourceAuthority: 2,
      reason: "Structured public award/open-data reference — not a fabricated package.",
    };
  }

  const text = haystack(input);
  const hasLp = LP_NAME_RE.test(text);
  const official = hostLooksOfficial(input.url);
  const authority: SourceAuthority = official
    ? DOWNLOADABLE_EXT_RE.test(input.url) || CONTRACT_PO_RE.test(text)
      ? 1
      : 2
    : 3;

  if (REFERENCE_API_RE.test(input.url) && !DOWNLOADABLE_EXT_RE.test(input.url)) {
    return {
      corpusRole: "REFERENCE_DATA",
      sourceAuthority: 2,
      reason: "Public API / open-data endpoint — REFERENCE_DATA only.",
    };
  }

  if (LICENSE_RE.test(text) && (hasLp || /tops\.portal\.texas\.gov/i.test(input.url))) {
    return {
      corpusRole: hasLp ? "L_AND_P_DIRECT" : "REFERENCE_DATA",
      sourceAuthority: official ? 1 : 2,
      reason: hasLp
        ? "Official license/disciplinary record naming L&P."
        : "License/open registry reference.",
    };
  }

  if (input.competitorEvidence && !hasLp) {
    return {
      corpusRole: "COMPETITOR_EVIDENCE",
      sourceAuthority: authority === 3 ? 2 : authority,
      reason: "Competitor/award evidence without L&P identity.",
    };
  }

  if (hasLp && CONTRACT_PO_RE.test(text) && !BOARD_PACKET_RE.test(text)) {
    return {
      corpusRole: "L_AND_P_DIRECT",
      sourceAuthority: official ? 1 : 2,
      reason: "Clear L&P identity on contract/PO/proposal-shaped primary source.",
    };
  }

  if (hasLp && BOARD_PACKET_RE.test(text)) {
    return {
      corpusRole: "BUYER_HISTORY",
      sourceAuthority: official ? 2 : 3,
      reason: "Board packet/agenda naming L&P — buyer history, not direct instrument alone.",
    };
  }

  if (hasLp) {
    return {
      corpusRole: "BUYER_HISTORY",
      sourceAuthority: authority === 3 ? 2 : authority,
      reason: "L&P named but instrument type ambiguous — BUYER_HISTORY (not L_AND_P_DIRECT).",
    };
  }

  if (BID_TAB_RE.test(text)) {
    return {
      corpusRole: "COMPETITOR_EVIDENCE",
      sourceAuthority: official ? 1 : 2,
      reason: "Bid tab without clear L&P — competitor/award evidence.",
    };
  }

  if (BOARD_PACKET_RE.test(text) || /\bisd\b|\bcounty\b|\bcity\b/i.test(text)) {
    return {
      corpusRole: "BUYER_HISTORY",
      sourceAuthority: official ? 2 : 3,
      reason: "Buyer board/procurement material without clear L&P.",
    };
  }

  if (/\bsecurity\b|\bguard\b|\bpatrol\b/i.test(text)) {
    return {
      corpusRole: "COMPARABLE_SECURITY",
      sourceAuthority: authority,
      reason: "Security procurement without L&P — comparable only.",
    };
  }

  return {
    corpusRole: "COMPETITOR_EVIDENCE",
    sourceAuthority: authority,
    reason: "Ambiguous public seed — conservative COMPETITOR_EVIDENCE (not L_AND_P_DIRECT).",
  };
}

/** Authority 3 rows must not be treated as primary evidence until a primary URL is found. */
export function isDiscoveryLeadOnly(authority: SourceAuthority): boolean {
  return authority === 3;
}

export function mapRoleToCorpusClass(
  role: AcquisitionCorpusRole,
): "A_LP_ORIGINATED" | "B_LP_TIED" | "C_COMPETITOR_TEST" | null {
  switch (role) {
    case "L_AND_P_DIRECT":
      return "A_LP_ORIGINATED";
    case "BUYER_HISTORY":
      return "B_LP_TIED";
    case "COMPETITOR_EVIDENCE":
    case "COMPARABLE_SECURITY":
      return "C_COMPETITOR_TEST";
    case "REFERENCE_DATA":
      return null;
    default:
      return null;
  }
}
