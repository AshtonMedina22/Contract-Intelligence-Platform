/**
 * Server-side working-proposal generation: assemble → artifact row.
 * Pure assembly stays in proposal-assembly.ts; this wires org data.
 */

import { assembleProposal, type AssembledProposal } from "@/lib/opportunity/proposal-assembly";
import { buildPortalAnswersExport } from "@/lib/export/portal-answers";
import { nextArtifactVersion } from "@/lib/opportunity/submission-artifacts";
import type { OrgProposalTemplate } from "@/lib/opportunity/org-proposal-template";

export type WorkingProposalSourceRow = {
  requirements: {
    id: string;
    statement: string;
    section_ref?: string | null;
  }[];
  responses: {
    requirement_id: string;
    draft_html: string;
    draft_status: string;
  }[];
  attachments?: {
    id: string;
    filename: string;
    document_type?: string | null;
  }[];
  cover?: {
    title?: string | null;
    buyerName?: string | null;
    solicitationRef?: string | null;
    dueOn?: string | null;
    frontMatter?: string | null;
  };
  pricingHref?: string | null;
  templateOverride?: Partial<OrgProposalTemplate> | null;
};

export function buildWorkingProposal(source: WorkingProposalSourceRow): {
  assembled: AssembledProposal;
  portal: ReturnType<typeof buildPortalAnswersExport>;
} {
  const assembled = assembleProposal({
    cover: source.cover,
    requirements: source.requirements,
    responses: source.responses,
    attachments: source.attachments,
    pricingRefs: source.pricingHref
      ? [{ label: "Pricing workbook", href: source.pricingHref, note: "Human-final rates live on Pricing." }]
      : [{ label: "Pricing workbook", note: "Open Pursuit → Pricing." }],
    templateOverride: source.templateOverride,
  });
  const portal = buildPortalAnswersExport({
    requirements: source.requirements,
    responses: source.responses,
  });
  return { assembled, portal };
}

export function computeNextVersion(existing: { version: number }[]): number {
  return nextArtifactVersion(existing.map((r) => r.version));
}
