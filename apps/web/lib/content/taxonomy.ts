/** Canonical proposal section taxonomy for F7 content intelligence. */

export const PROPOSAL_SECTION_KEYS = [
  "staffing",
  "management",
  "transition",
  "recruiting",
  "training",
  "quality_control",
  "emergency_response",
  "technology",
  "incident_reporting",
  "past_performance",
  "business_continuity",
  "background_screening",
  "customer_service",
] as const;

export type ProposalSectionKey = (typeof PROPOSAL_SECTION_KEYS)[number];

/** Human-facing heading aliases → canonical key. */
export const SECTION_HEADING_ALIASES: Record<ProposalSectionKey, string[]> = {
  staffing: ["staffing", "staffing plan", "personnel", "manpower", "workforce"],
  management: ["management", "project management", "account management", "supervision", "management approach"],
  transition: ["transition", "transition plan", "implementation", "mobilization", "start-up", "startup"],
  recruiting: ["recruiting", "recruitment", "hiring", "talent acquisition"],
  training: ["training", "training program", "orientation", "professional development"],
  quality_control: ["quality control", "quality assurance", "qa/qc", "qc", "qa", "quality management"],
  emergency_response: ["emergency response", "emergency action", "eap", "crisis response", "incident response plan"],
  technology: ["technology", "systems", "software", "platforms", "reporting systems", "technology plan"],
  incident_reporting: ["incident reporting", "incident reports", "ir", "occurrence reporting"],
  past_performance: ["past performance", "relevant experience", "references", "prior contracts", "performance history"],
  business_continuity: ["business continuity", "continuity of operations", "coop", "disaster recovery"],
  background_screening: ["background screening", "background checks", "vetting", "clearance", "criminal history"],
  customer_service: ["customer service", "client service", "customer care", "service excellence"],
};

export function isProposalSectionKey(value: string): value is ProposalSectionKey {
  return (PROPOSAL_SECTION_KEYS as readonly string[]).includes(value);
}

/** Normalize free text / slug toward a canonical section key, or null. */
export function normalizeSectionKey(raw: string | null | undefined): ProposalSectionKey | null {
  if (!raw) return null;
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (isProposalSectionKey(slug)) return slug;

  const heading = raw.trim().toLowerCase().replace(/\s+/g, " ");
  for (const key of PROPOSAL_SECTION_KEYS) {
    for (const alias of SECTION_HEADING_ALIASES[key]) {
      if (heading === alias) return key;
      // Avoid short aliases (eap, qc, qa, ir) matching body sentences.
      if (alias.length < 4) continue;
      if (heading.startsWith(`${alias} `) || heading.startsWith(`${alias}:`)) {
        // Remainder after alias should be short (subtitle), not a full sentence.
        const rest = heading.slice(alias.length).replace(/^[\s:]+/, "");
        if (rest.length <= 40) return key;
      }
    }
  }
  return null;
}

/** Match a line that looks like a section heading against the taxonomy. */
export function matchHeadingToSectionKey(line: string): ProposalSectionKey | null {
  const cleaned = line
    .replace(/^#+\s*/, "")
    .replace(/^\d+(\.\d+)*[.)]\s*/, "")
    .replace(/^[A-Z][.)]\s*/, "")
    .replace(/[:\-–—]+\s*$/, "")
    .trim();
  if (!cleaned || cleaned.length > 80) return null;
  // Body paragraphs are longer; headings are typically short.
  if (cleaned.split(/\s+/).length > 8) return null;
  return normalizeSectionKey(cleaned);
}

export function sectionKeyLabel(key: ProposalSectionKey): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
