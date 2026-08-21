/**
 * Recipient / agency party normalization for federal award research.
 *
 * Match existing clients or competitors by exact normalized name or UEI when
 * supplied — never invent CRM buyers or competitors. Ambiguous hits return
 * reconciliation candidates without guessing a link.
 */

export type PartyRecord = {
  id: string;
  name: string;
  /** UEI when the row (or research payload) supplies one. Clients/competitors tables may not have a column. */
  uei?: string | null;
  cage?: string | null;
  aliases?: string[] | null;
};

export type NormalizedParty = {
  display_name: string;
  normalized_name: string;
  aliases: string[];
  uei: string | null;
  cage: string | null;
};

export type PartyMatchResult = {
  match: PartyRecord | null;
  ambiguity: boolean;
  candidates: Array<{
    status: "queued_identity";
    suggested_name: string;
    uei: string | null;
    party_id?: string;
    reason: string;
  }>;
};

const CORP_SUFFIX_RE =
  /\b(inc|incorporated|llc|l\.l\.c|corp|corporation|co|company|ltd|limited|lp|l\.p|plc|pllc|pc|p\.c)\b\.?/gi;

/** Collapse whitespace, strip common corporate suffixes, uppercase for exact compare. */
export function normalizePartyName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .normalize("NFKC")
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}\s&.-]/gu, " ")
    .replace(CORP_SUFFIX_RE, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function normalizeUei(uei: string | null | undefined): string | null {
  if (!uei) return null;
  const cleaned = uei.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.length > 0 ? cleaned : null;
}

export function normalizeCage(cage: string | null | undefined): string | null {
  if (!cage) return null;
  const cleaned = cage.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.length > 0 ? cleaned : null;
}

export function normalizeParty(input: {
  name?: string | null;
  uei?: string | null;
  cage?: string | null;
  aliases?: string[] | null;
}): NormalizedParty {
  const display = (input.name ?? "").trim();
  const aliases = [
    ...new Set(
      (input.aliases ?? [])
        .map((a) => a.trim())
        .filter(Boolean)
        .concat(display ? [display] : []),
    ),
  ];
  return {
    display_name: display,
    normalized_name: normalizePartyName(display),
    aliases,
    uei: normalizeUei(input.uei),
    cage: normalizeCage(input.cage),
  };
}

function partyKeys(party: PartyRecord): Set<string> {
  const keys = new Set<string>();
  const primary = normalizePartyName(party.name);
  if (primary) keys.add(`name:${primary}`);
  for (const alias of party.aliases ?? []) {
    const n = normalizePartyName(alias);
    if (n) keys.add(`name:${n}`);
  }
  const uei = normalizeUei(party.uei);
  if (uei) keys.add(`uei:${uei}`);
  return keys;
}

/**
 * Exact normalized-name or UEI match only. Soft duplicate names that normalize
 * identically count as the same key; multiple distinct rows sharing that key → ambiguity.
 */
export function matchExistingParty(
  needle: { name?: string | null; uei?: string | null },
  existing: PartyRecord[],
): PartyMatchResult {
  const normalized = normalizeParty(needle);
  if (!normalized.normalized_name && !normalized.uei) {
    return { match: null, ambiguity: false, candidates: [] };
  }

  const hits: PartyRecord[] = [];
  for (const party of existing) {
    const keys = partyKeys(party);
    const byUei = normalized.uei ? keys.has(`uei:${normalized.uei}`) : false;
    const byName = normalized.normalized_name
      ? keys.has(`name:${normalized.normalized_name}`)
      : false;
    if (byUei || byName) hits.push(party);
  }

  if (hits.length === 1) {
    return { match: hits[0]!, ambiguity: false, candidates: [] };
  }

  if (hits.length > 1) {
    return {
      match: null,
      ambiguity: true,
      candidates: hits.map((p) => ({
        status: "queued_identity" as const,
        suggested_name: p.name,
        uei: normalizeUei(p.uei) ?? normalized.uei,
        party_id: p.id,
        reason: "Multiple existing parties share the normalized name or UEI — no auto-link.",
      })),
    };
  }

  // No existing link. Soft-match note: if the needle normalizes the same as another
  // display variant we already checked exact keys — remaining case is "no match".
  // Return an empty-candidate reconciliation stub so tools can surface identity work.
  if (normalized.display_name || normalized.uei) {
    return {
      match: null,
      ambiguity: false,
      candidates: [],
    };
  }

  return { match: null, ambiguity: false, candidates: [] };
}

export function matchExistingCompetitor(
  needle: { name?: string | null; uei?: string | null },
  competitors: PartyRecord[],
): PartyMatchResult {
  return matchExistingParty(needle, competitors);
}

export function matchExistingClient(
  needle: { name?: string | null; uei?: string | null },
  clients: PartyRecord[],
): PartyMatchResult {
  return matchExistingParty(needle, clients);
}

/**
 * Detect whether two display names are the same party after normalization
 * (e.g. "Acme Corp." vs "ACME CORPORATION") — used for soft-match tests, not auto-link.
 */
export function namesNormalizeEqual(a: string, b: string): boolean {
  const na = normalizePartyName(a);
  const nb = normalizePartyName(b);
  return Boolean(na) && na === nb;
}
