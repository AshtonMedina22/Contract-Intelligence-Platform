/**
 * Structured portal-paste export: requirement → approved answer as CSV / JSON.
 */

import {
  htmlToPlainText,
  escapeDocxText,
  type AssemblyRequirement,
  type AssemblyResponse,
} from "@/lib/opportunity/proposal-assembly";

export type PortalAnswerRow = {
  requirement_id: string;
  section_ref: string | null;
  requirement_statement: string;
  answer_plain: string;
  draft_status: string;
};

export type PortalAnswersExport = {
  rows: PortalAnswerRow[];
  json: string;
  csv: string;
  excludedUnapproved: number;
  excludedEmpty: number;
};

function csvEscape(value: string): string {
  const needs = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needs ? `"${escaped}"` : escaped;
}

/**
 * Build portal-ready answers from APPROVED responses only.
 * Ordering follows requirement section_ref / statement — not GPT order.
 */
export function buildPortalAnswersExport(input: {
  requirements: AssemblyRequirement[];
  responses: AssemblyResponse[];
  includeUnapproved?: boolean;
}): PortalAnswersExport {
  const reqById = new Map(input.requirements.map((r) => [r.id, r]));
  let excludedUnapproved = 0;
  let excludedEmpty = 0;
  const rows: PortalAnswerRow[] = [];

  for (const resp of input.responses) {
    const req = reqById.get(resp.requirement_id);
    if (!req) continue;
    const html = (resp.draft_html ?? "").trim();
    if (!html) {
      excludedEmpty += 1;
      continue;
    }
    const approved = resp.draft_status === "APPROVED";
    if (!approved && !input.includeUnapproved) {
      excludedUnapproved += 1;
      continue;
    }
    rows.push({
      requirement_id: req.id,
      section_ref: req.section_ref ?? null,
      requirement_statement: req.statement,
      answer_plain: escapeDocxText(htmlToPlainText(html)),
      draft_status: resp.draft_status,
    });
  }

  rows.sort((a, b) => {
    const ar = a.section_ref ?? "";
    const br = b.section_ref ?? "";
    return ar.localeCompare(br, undefined, { numeric: true }) || a.requirement_id.localeCompare(b.requirement_id);
  });

  const json = JSON.stringify(
    {
      format: "portal_answers_v1",
      generated_note: "Approved requirement answers only. Paste per buyer portal field.",
      count: rows.length,
      answers: rows,
    },
    null,
    2,
  );

  const header = ["requirement_id", "section_ref", "requirement_statement", "answer_plain", "draft_status"];
  const csvLines = [
    header.join(","),
    ...rows.map((r) =>
      [
        csvEscape(r.requirement_id),
        csvEscape(r.section_ref ?? ""),
        csvEscape(r.requirement_statement),
        csvEscape(r.answer_plain),
        csvEscape(r.draft_status),
      ].join(","),
    ),
  ];

  return {
    rows,
    json,
    csv: csvLines.join("\n"),
    excludedUnapproved,
    excludedEmpty,
  };
}
