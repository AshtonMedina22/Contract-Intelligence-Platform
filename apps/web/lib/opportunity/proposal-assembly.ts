/**
 * Deterministic working-proposal assembly from APPROVED requirement responses.
 * Section order comes only from the org template — never GPT / arrival order.
 */

import { createHash } from "node:crypto";
import {
  resolveOrgProposalTemplate,
  sortedTemplateSections,
  type OrgProposalTemplate,
  type ProposalTemplateSectionKey,
} from "./org-proposal-template";

export type AssemblyRequirement = {
  id: string;
  statement: string;
  section_ref?: string | null;
  sort_hint?: number | null;
};

export type AssemblyResponse = {
  requirement_id: string;
  draft_html: string;
  draft_status: "EMPTY" | "DRAFT" | "APPROVED" | string;
};

export type AssemblyAttachmentRef = {
  id: string;
  filename: string;
  document_type?: string | null;
};

export type AssemblyPricingRef = {
  label: string;
  href?: string | null;
  note?: string | null;
};

export type AssemblyCover = {
  title?: string | null;
  buyerName?: string | null;
  solicitationRef?: string | null;
  dueOn?: string | null;
  frontMatter?: string | null;
};

export type AssembledSection = {
  key: ProposalTemplateSectionKey;
  title: string;
  order: number;
  /** Plain text for DOCX / Google Docs / portal. */
  plainText: string;
  /** Escaped HTML fragment for print / HTML download. */
  html: string;
  /** Requirement ids contributing to this section (when applicable). */
  sourceRequirementIds: string[];
};

export type AssembledProposal = {
  templateId: string;
  title: string;
  sections: AssembledSection[];
  htmlDocument: string;
  plainDocument: string;
  contentHash: string;
  sources: {
    requirementIds: string[];
    excludedDraftOnly: number;
    excludedEmpty: number;
    attachmentIds: string[];
    pricingRefs: string[];
  };
};

/** Escape text for safe HTML embedding. */
export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strip tags to plain text; decode a minimal set of entities. */
export function htmlToPlainText(html: string): string {
  const withoutTags = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n")
    .replace(/<\/\s*div\s*>/gi, "\n")
    .replace(/<\/\s*li\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\/\s*tr\s*>/gi, "\n")
    .replace(/<\/\s*h[1-6]\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\u00a0/g, " ");
  return withoutTags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Escape characters that break OOXML text runs when embedded as text nodes.
 * (docx library handles most escaping; this is for plain-text builders / portal.)
 */
export function escapeDocxText(raw: string): string {
  return raw.replace(/\u0000/g, "").replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function plainBlock(title: string, body: string): string {
  const t = escapeDocxText(title.trim());
  const b = escapeDocxText(body.trim());
  if (!b) return t;
  return `${t}\n\n${b}`;
}

function htmlSection(title: string, bodyHtml: string): string {
  return `<section data-section="${escapeHtml(title)}"><h2>${escapeHtml(title)}</h2>${bodyHtml}</section>`;
}

function requirementSortKey(req: AssemblyRequirement, index: number): number {
  if (typeof req.sort_hint === "number" && Number.isFinite(req.sort_hint)) return req.sort_hint;
  const ref = req.section_ref?.trim() ?? "";
  if (ref) {
    const m = ref.match(/(\d+(?:\.\d+)*)/);
    if (m) {
      const parts = m[1].split(".").map((p) => Number(p));
      let score = 0;
      for (let i = 0; i < parts.length; i += 1) score += parts[i]! * 1000 ** (4 - i);
      return score;
    }
  }
  return 1_000_000 + index;
}

export type AssembleProposalInput = {
  cover?: AssemblyCover | null;
  requirements: AssemblyRequirement[];
  responses: AssemblyResponse[];
  attachments?: AssemblyAttachmentRef[];
  pricingRefs?: AssemblyPricingRef[];
  /** Optional named section bodies (staffing, management, …) — only APPROVED text. */
  namedSections?: Partial<Record<ProposalTemplateSectionKey, string>>;
  templateOverride?: Partial<OrgProposalTemplate> | null;
  /** When true, include DRAFT responses (tests / preview only). Default false. */
  includeUnapproved?: boolean;
};

/**
 * Assemble a working proposal. Only APPROVED responses are included by default.
 * Ordering is template order, then requirement section_ref / sort_hint within
 * the requirements section — never response upsert order.
 */
export function assembleProposal(input: AssembleProposalInput): AssembledProposal {
  const template = resolveOrgProposalTemplate(input.templateOverride);
  const reqById = new Map(input.requirements.map((r) => [r.id, r]));
  const includeUnapproved = Boolean(input.includeUnapproved);

  let excludedDraftOnly = 0;
  let excludedEmpty = 0;

  const approvedPairs: { req: AssemblyRequirement; html: string; index: number }[] = [];
  input.responses.forEach((resp, index) => {
    const req = reqById.get(resp.requirement_id);
    if (!req) return;
    const html = (resp.draft_html ?? "").trim();
    if (!html) {
      excludedEmpty += 1;
      return;
    }
    const approved = resp.draft_status === "APPROVED";
    if (!approved && !includeUnapproved) {
      excludedDraftOnly += 1;
      return;
    }
    approvedPairs.push({ req, html, index });
  });

  approvedPairs.sort(
    (a, b) =>
      requirementSortKey(a.req, a.index) - requirementSortKey(b.req, b.index) ||
      a.req.id.localeCompare(b.req.id),
  );

  const attachments = input.attachments ?? [];
  const pricingRefs = input.pricingRefs ?? [];
  const named = input.namedSections ?? {};
  const cover = input.cover ?? {};

  const sections: AssembledSection[] = [];

  for (const slot of sortedTemplateSections(template)) {
    let plainText = "";
    let html = "";
    const sourceRequirementIds: string[] = [];

    switch (slot.key) {
      case "cover": {
        const lines = [
          cover.title?.trim() || template.coverTitle,
          cover.buyerName ? `Buyer: ${cover.buyerName}` : null,
          cover.solicitationRef ? `Solicitation: ${cover.solicitationRef}` : null,
          cover.dueOn ? `Due: ${cover.dueOn}` : null,
          cover.frontMatter?.trim() || template.frontMatter?.trim() || null,
        ].filter(Boolean) as string[];
        plainText = lines.join("\n");
        html = `<div class="cover">${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}</div>`;
        break;
      }
      case "requirements": {
        if (approvedPairs.length === 0) {
          if (!slot.includeWhenEmpty) continue;
          plainText = "(No approved requirement responses.)";
          html = `<p class="empty">${escapeHtml(plainText)}</p>`;
          break;
        }
        const plainParts: string[] = [];
        const htmlParts: string[] = [];
        for (const pair of approvedPairs) {
          sourceRequirementIds.push(pair.req.id);
          const heading = pair.req.section_ref
            ? `${pair.req.section_ref} — ${pair.req.statement}`
            : pair.req.statement;
          const bodyPlain = htmlToPlainText(pair.html);
          plainParts.push(plainBlock(heading, bodyPlain));
          htmlParts.push(
            `<article data-requirement-id="${escapeHtml(pair.req.id)}"><h3>${escapeHtml(heading)}</h3>${pair.html}</article>`,
          );
        }
        plainText = plainParts.join("\n\n");
        html = htmlParts.join("\n");
        break;
      }
      case "attachments": {
        if (attachments.length === 0) {
          if (!slot.includeWhenEmpty) continue;
          plainText = "(No attachments listed.)";
          html = `<p class="empty">${escapeHtml(plainText)}</p>`;
          break;
        }
        plainText = attachments
          .map((a) => `- ${a.filename}${a.document_type ? ` (${a.document_type})` : ""}`)
          .join("\n");
        html = `<ul>${attachments
          .map(
            (a) =>
              `<li data-document-id="${escapeHtml(a.id)}">${escapeHtml(a.filename)}${
                a.document_type ? ` <span>(${escapeHtml(a.document_type)})</span>` : ""
              }</li>`,
          )
          .join("")}</ul>`;
        break;
      }
      case "pricing_ref": {
        if (pricingRefs.length === 0) {
          if (!slot.includeWhenEmpty) continue;
          plainText = "(Pricing workbook linked from Pursuit → Pricing.)";
          html = `<p class="empty">${escapeHtml(plainText)}</p>`;
          break;
        }
        plainText = pricingRefs
          .map((p) => `- ${p.label}${p.note ? `: ${p.note}` : ""}${p.href ? ` [${p.href}]` : ""}`)
          .join("\n");
        html = `<ul>${pricingRefs
          .map((p) => {
            const label = escapeHtml(p.label);
            const note = p.note ? ` — ${escapeHtml(p.note)}` : "";
            const link = p.href
              ? `<a href="${escapeHtml(p.href)}">${label}</a>`
              : label;
            return `<li>${link}${note}</li>`;
          })
          .join("")}</ul>`;
        break;
      }
      default: {
        const body = (named[slot.key] ?? "").trim();
        if (!body) {
          if (!slot.includeWhenEmpty) continue;
          continue;
        }
        plainText = htmlToPlainText(body).trim() || body;
        // Named bodies may already be HTML; if they look like tags, pass through after null-byte scrub.
        html = /<[a-z][\s\S]*>/i.test(body)
          ? body.replace(/\u0000/g, "")
          : `<p>${escapeHtml(body)}</p>`;
        break;
      }
    }

    if (!plainText.trim() && !slot.includeWhenEmpty) continue;

    sections.push({
      key: slot.key,
      title: slot.title,
      order: slot.order,
      plainText: escapeDocxText(plainText),
      html: htmlSection(slot.title, html),
      sourceRequirementIds,
    });
  }

  const title = cover.title?.trim() || template.coverTitle;
  const bodyHtml = sections.map((s) => s.html).join("\n");
  const htmlDocument = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title></head><body><h1>${escapeHtml(title)}</h1>\n${bodyHtml}</body></html>`;
  const plainDocument = [title, ...sections.map((s) => plainBlock(s.title, s.plainText))]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const contentHash = createHash("sha256")
    .update(
      JSON.stringify({
        templateId: template.id,
        title,
        sections: sections.map((s) => ({ key: s.key, order: s.order, plain: s.plainText })),
      }),
    )
    .digest("hex");

  return {
    templateId: template.id,
    title,
    sections,
    htmlDocument,
    plainDocument,
    contentHash,
    sources: {
      requirementIds: approvedPairs.map((p) => p.req.id),
      excludedDraftOnly,
      excludedEmpty,
      attachmentIds: attachments.map((a) => a.id),
      pricingRefs: pricingRefs.map((p) => p.label),
    },
  };
}
