/**
 * Org-level proposal section template. Defaults are L&P-shaped working-proposal
 * order — never buyer-layout hard-coding, never GPT-ordered.
 */

export type ProposalTemplateSectionKey =
  | "cover"
  | "executive_summary"
  | "requirements"
  | "staffing"
  | "management"
  | "transition"
  | "past_performance"
  | "attachments"
  | "pricing_ref"
  | "closing";

export type OrgProposalTemplateSection = {
  key: ProposalTemplateSectionKey;
  title: string;
  /** Stable sort; lower first. Org overrides may insert between integers. */
  order: number;
  /** When false, section is omitted unless content exists for it. */
  includeWhenEmpty: boolean;
};

export type OrgProposalTemplate = {
  id: string;
  name: string;
  sections: OrgProposalTemplateSection[];
  coverTitle: string;
  frontMatter?: string | null;
};

/** Default working-proposal order used when the org has no override. */
export const DEFAULT_ORG_PROPOSAL_TEMPLATE: OrgProposalTemplate = {
  id: "default",
  name: "Default working proposal",
  coverTitle: "Proposal Response",
  frontMatter: null,
  sections: [
    { key: "cover", title: "Cover", order: 10, includeWhenEmpty: true },
    { key: "executive_summary", title: "Executive summary", order: 20, includeWhenEmpty: false },
    { key: "requirements", title: "Requirement responses", order: 30, includeWhenEmpty: true },
    { key: "staffing", title: "Staffing", order: 40, includeWhenEmpty: false },
    { key: "management", title: "Management", order: 50, includeWhenEmpty: false },
    { key: "transition", title: "Transition", order: 60, includeWhenEmpty: false },
    { key: "past_performance", title: "Past performance", order: 70, includeWhenEmpty: false },
    { key: "attachments", title: "Attachments", order: 80, includeWhenEmpty: false },
    { key: "pricing_ref", title: "Pricing", order: 90, includeWhenEmpty: false },
    { key: "closing", title: "Closing", order: 100, includeWhenEmpty: false },
  ],
};

/**
 * Merge org override onto defaults. Unknown keys are ignored. Order is always
 * taken from the resolved template — never from content arrival order.
 */
export function resolveOrgProposalTemplate(
  override?: Partial<OrgProposalTemplate> | null,
): OrgProposalTemplate {
  if (!override) return structuredClone(DEFAULT_ORG_PROPOSAL_TEMPLATE);

  const base = structuredClone(DEFAULT_ORG_PROPOSAL_TEMPLATE);
  const byKey = new Map(base.sections.map((s) => [s.key, s]));

  if (Array.isArray(override.sections)) {
    for (const section of override.sections) {
      if (!section?.key || !byKey.has(section.key)) continue;
      const existing = byKey.get(section.key)!;
      byKey.set(section.key, {
        ...existing,
        title: typeof section.title === "string" && section.title.trim() ? section.title : existing.title,
        order: typeof section.order === "number" ? section.order : existing.order,
        includeWhenEmpty:
          typeof section.includeWhenEmpty === "boolean"
            ? section.includeWhenEmpty
            : existing.includeWhenEmpty,
      });
    }
  }

  const sections = [...byKey.values()].sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));

  return {
    id: override.id?.trim() || base.id,
    name: override.name?.trim() || base.name,
    coverTitle: override.coverTitle?.trim() || base.coverTitle,
    frontMatter:
      override.frontMatter === undefined ? base.frontMatter : override.frontMatter,
    sections,
  };
}

export function sortedTemplateSections(template: OrgProposalTemplate): OrgProposalTemplateSection[] {
  return [...template.sections].sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
}
