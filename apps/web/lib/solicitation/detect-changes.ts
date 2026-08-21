/**
 * F11 pure heuristic change detection.
 * SemanticDiff is rejected — not used. Optional diff-match-patch deliberately not used in v1.
 * Honest summary counts only — never invent precision.
 */

import {
  DETECTOR_VERSION,
  defaultImpactFlags,
  type SolicitationChangeType,
} from "./change-types";

export type SnapshotRequirement = {
  id?: string | null;
  statement: string;
  section_ref?: string | null;
  mandatory?: boolean | null;
};

export type SnapshotForm = {
  id?: string | null;
  form_name: string;
  section_ref?: string | null;
};

export type SnapshotPricingHint = {
  labor_category?: string | null;
  site_or_post?: string | null;
  requested_rate?: number | string | null;
};

export type SnapshotDeadline = {
  kind: "response" | "questions" | "conference" | "prebid" | "submission";
  due_on: string | null;
};

export type SolicitationSnapshot = {
  requirements?: SnapshotRequirement[];
  forms?: SnapshotForm[];
  pricingHints?: SnapshotPricingHint[];
  deadlines?: SnapshotDeadline[];
  evaluationNotes?: string | null;
  scopeNotes?: string | null;
  staffingNotes?: string | null;
  complianceNotes?: string | null;
  submissionMethod?: string | null;
  qaPairs?: Array<{ question: string; answer?: string | null; section_ref?: string | null }>;
};

export type DetectedChangeItem = {
  change_type: SolicitationChangeType;
  fingerprint: string;
  target_table: string | null;
  target_id: string | null;
  before_text: string | null;
  after_text: string | null;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  confidence: "heuristic" | "exact" | "ambiguous";
  ambiguity_reason: string | null;
  impact_flags: ReturnType<typeof defaultImpactFlags>;
  verification_status: "AI_EXTRACTED" | "NEEDS_REVIEW" | "CONFLICT";
};

export type DetectChangesSummary = {
  matched: number;
  changed: number;
  added: number;
  removed: number;
  ambiguous: number;
  unreviewed: number;
  by_type: Partial<Record<SolicitationChangeType, number>>;
  detector_version: string;
  note: string;
};

export type DetectChangesResult = {
  items: DetectedChangeItem[];
  summary: DetectChangesSummary;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function fingerprint(parts: Array<string | null | undefined>): string {
  return parts.map((p) => normalizeText(p)).filter(Boolean).join("|").slice(0, 240);
}

function reqKey(r: SnapshotRequirement): string {
  const section = normalizeText(r.section_ref);
  if (section) return `sec:${section}`;
  return `stmt:${normalizeText(r.statement).slice(0, 120)}`;
}

function formKey(f: SnapshotForm): string {
  return normalizeText(f.form_name);
}

function pricingKey(p: SnapshotPricingHint): string {
  return `${normalizeText(p.labor_category)}|${normalizeText(p.site_or_post)}`;
}

function deadlineKey(d: SnapshotDeadline): string {
  return d.kind;
}

function pushItem(
  items: DetectedChangeItem[],
  partial: Omit<DetectedChangeItem, "impact_flags" | "verification_status"> & {
    verification_status?: DetectedChangeItem["verification_status"];
  },
) {
  const ambiguous = Boolean(partial.ambiguity_reason) || partial.confidence === "ambiguous";
  items.push({
    ...partial,
    impact_flags: defaultImpactFlags(partial.change_type),
    verification_status: partial.verification_status ?? (ambiguous ? "CONFLICT" : "AI_EXTRACTED"),
  });
}

/**
 * Compare baseline (original solicitation / prior latest) vs candidate (addendum or Q&A extract).
 * Conflicting clarifications that disagree with an existing requirement without a clear match
 * land as ambiguous/CONFLICT and must not auto-apply.
 */
export function detectSolicitationChanges(
  baseline: SolicitationSnapshot,
  candidate: SolicitationSnapshot,
  options?: { triggerKind?: "ADDENDUM" | "Q_AND_A" | "CLARIFICATION" },
): DetectChangesResult {
  const items: DetectedChangeItem[] = [];
  const baseReqs = baseline.requirements ?? [];
  const candReqs = candidate.requirements ?? [];
  const baseByKey = new Map(baseReqs.map((r) => [reqKey(r), r]));
  const candByKey = new Map(candReqs.map((r) => [reqKey(r), r]));
  const matchedKeys = new Set<string>();

  for (const [key, cand] of candByKey) {
    const base = baseByKey.get(key);
    if (!base) {
      // Possible soft match on statement similarity — if two candidates collide, ambiguous
      const soft = baseReqs.filter(
        (b) =>
          normalizeText(b.statement).slice(0, 40) === normalizeText(cand.statement).slice(0, 40) &&
          normalizeText(b.statement) !== normalizeText(cand.statement),
      );
      if (soft.length > 1) {
        pushItem(items, {
          change_type: "REQUIREMENT_MODIFIED",
          fingerprint: fingerprint(["amb", "req", key, cand.statement]),
          target_table: "requirements",
          target_id: soft[0]?.id ?? null,
          before_text: soft.map((s) => s.statement).join(" || "),
          after_text: cand.statement,
          before_json: { candidates: soft.length },
          after_json: { statement: cand.statement, section_ref: cand.section_ref ?? null },
          confidence: "ambiguous",
          ambiguity_reason: `Multiple baseline requirements match prefix for "${key}" — human must resolve.`,
        });
        continue;
      }
      pushItem(items, {
        change_type: "REQUIREMENT_ADDED",
        fingerprint: fingerprint(["add", "req", key, cand.statement]),
        target_table: "requirements",
        target_id: null,
        before_text: null,
        after_text: cand.statement,
        before_json: null,
        after_json: {
          statement: cand.statement,
          section_ref: cand.section_ref ?? null,
          mandatory: cand.mandatory ?? true,
        },
        confidence: "heuristic",
        ambiguity_reason: null,
      });
      continue;
    }
    matchedKeys.add(key);
    if (normalizeText(base.statement) !== normalizeText(cand.statement)) {
      pushItem(items, {
        change_type: "REQUIREMENT_MODIFIED",
        fingerprint: fingerprint(["mod", "req", key, base.statement, cand.statement]),
        target_table: "requirements",
        target_id: base.id ?? null,
        before_text: base.statement,
        after_text: cand.statement,
        before_json: { statement: base.statement, section_ref: base.section_ref ?? null },
        after_json: { statement: cand.statement, section_ref: cand.section_ref ?? null },
        confidence: base.section_ref && cand.section_ref ? "exact" : "heuristic",
        ambiguity_reason: null,
      });
    }
  }

  for (const [key, base] of baseByKey) {
    if (matchedKeys.has(key) || candByKey.has(key)) continue;
    // Only emit removals when candidate explicitly lists requirements (empty list ≠ wipe)
    if (candReqs.length === 0) continue;
    pushItem(items, {
      change_type: "REQUIREMENT_REMOVED",
      fingerprint: fingerprint(["rem", "req", key, base.statement]),
      target_table: "requirements",
      target_id: base.id ?? null,
      before_text: base.statement,
      after_text: null,
      before_json: { statement: base.statement, section_ref: base.section_ref ?? null },
      after_json: null,
      confidence: "heuristic",
      ambiguity_reason: null,
    });
  }

  // Forms
  const baseForms = new Map((baseline.forms ?? []).map((f) => [formKey(f), f]));
  const candForms = new Map((candidate.forms ?? []).map((f) => [formKey(f), f]));
  for (const [key, cand] of candForms) {
    if (!baseForms.has(key)) {
      pushItem(items, {
        change_type: "FORM_ADDED",
        fingerprint: fingerprint(["add", "form", key]),
        target_table: "required_forms",
        target_id: null,
        before_text: null,
        after_text: cand.form_name,
        before_json: null,
        after_json: { form_name: cand.form_name, section_ref: cand.section_ref ?? null },
        confidence: "exact",
        ambiguity_reason: null,
      });
    }
  }
  if ((candidate.forms ?? []).length > 0) {
    for (const [key, base] of baseForms) {
      if (!candForms.has(key)) {
        pushItem(items, {
          change_type: "FORM_REMOVED",
          fingerprint: fingerprint(["rem", "form", key]),
          target_table: "required_forms",
          target_id: base.id ?? null,
          before_text: base.form_name,
          after_text: null,
          before_json: { form_name: base.form_name },
          after_json: null,
          confidence: "exact",
          ambiguity_reason: null,
        });
      }
    }
  }

  // Pricing hints
  const basePrice = new Map((baseline.pricingHints ?? []).map((p) => [pricingKey(p), p]));
  for (const cand of candidate.pricingHints ?? []) {
    const key = pricingKey(cand);
    const base = basePrice.get(key);
    const candRate = cand.requested_rate == null ? null : String(cand.requested_rate);
    const baseRate = base?.requested_rate == null ? null : String(base.requested_rate);
    if (!base) {
      pushItem(items, {
        change_type: "PRICING_CHANGE",
        fingerprint: fingerprint(["add", "price", key, candRate]),
        target_table: "pricing_lines",
        target_id: null,
        before_text: null,
        after_text: candRate,
        before_json: null,
        after_json: {
          labor_category: cand.labor_category ?? null,
          site_or_post: cand.site_or_post ?? null,
          requested_rate: cand.requested_rate ?? null,
        },
        confidence: "heuristic",
        ambiguity_reason: null,
      });
    } else if (normalizeText(baseRate) !== normalizeText(candRate)) {
      pushItem(items, {
        change_type: "PRICING_CHANGE",
        fingerprint: fingerprint(["mod", "price", key, baseRate, candRate]),
        target_table: "pricing_lines",
        target_id: null,
        before_text: baseRate,
        after_text: candRate,
        before_json: {
          labor_category: base.labor_category ?? null,
          requested_rate: base.requested_rate ?? null,
        },
        after_json: {
          labor_category: cand.labor_category ?? null,
          requested_rate: cand.requested_rate ?? null,
        },
        confidence: "heuristic",
        ambiguity_reason: null,
      });
    }
  }

  // Deadlines
  const baseDeadlines = new Map((baseline.deadlines ?? []).map((d) => [deadlineKey(d), d]));
  for (const cand of candidate.deadlines ?? []) {
    const base = baseDeadlines.get(deadlineKey(cand));
    if (!base) {
      if (cand.due_on) {
        pushItem(items, {
          change_type: "DEADLINE_CHANGE",
          fingerprint: fingerprint(["add", "deadline", cand.kind, cand.due_on]),
          target_table: "opportunities",
          target_id: null,
          before_text: null,
          after_text: cand.due_on,
          before_json: null,
          after_json: { kind: cand.kind, due_on: cand.due_on },
          confidence: "exact",
          ambiguity_reason: null,
        });
      }
      continue;
    }
    if (normalizeText(base.due_on) !== normalizeText(cand.due_on) && cand.due_on) {
      pushItem(items, {
        change_type: "DEADLINE_CHANGE",
        fingerprint: fingerprint(["mod", "deadline", cand.kind, base.due_on, cand.due_on]),
        target_table: "opportunities",
        target_id: null,
        before_text: base.due_on,
        after_text: cand.due_on,
        before_json: { kind: base.kind, due_on: base.due_on },
        after_json: { kind: cand.kind, due_on: cand.due_on },
        confidence: "exact",
        ambiguity_reason: null,
      });
    }
  }

  // Free-text note deltas
  const notePairs: Array<{
    change_type: SolicitationChangeType;
    before: string | null | undefined;
    after: string | null | undefined;
    label: string;
  }> = [
    { change_type: "EVALUATION_CHANGE", before: baseline.evaluationNotes, after: candidate.evaluationNotes, label: "evaluation" },
    { change_type: "SCOPE_CHANGE", before: baseline.scopeNotes, after: candidate.scopeNotes, label: "scope" },
    { change_type: "STAFFING_CHANGE", before: baseline.staffingNotes, after: candidate.staffingNotes, label: "staffing" },
    { change_type: "COMPLIANCE_CHANGE", before: baseline.complianceNotes, after: candidate.complianceNotes, label: "compliance" },
  ];
  for (const n of notePairs) {
    if (!n.after) continue;
    if (normalizeText(n.before) === normalizeText(n.after)) continue;
    pushItem(items, {
      change_type: n.change_type,
      fingerprint: fingerprint(["note", n.label, n.before, n.after]),
      target_table: null,
      target_id: null,
      before_text: n.before ?? null,
      after_text: n.after,
      before_json: n.before ? { text: n.before } : null,
      after_json: { text: n.after },
      confidence: "heuristic",
      ambiguity_reason: null,
    });
  }

  if (
    candidate.submissionMethod &&
    normalizeText(baseline.submissionMethod) !== normalizeText(candidate.submissionMethod)
  ) {
    pushItem(items, {
      change_type: "SUBMISSION_METHOD_CHANGE",
      fingerprint: fingerprint(["method", baseline.submissionMethod, candidate.submissionMethod]),
      target_table: "opportunities",
      target_id: null,
      before_text: baseline.submissionMethod ?? null,
      after_text: candidate.submissionMethod,
      before_json: { submission_method: baseline.submissionMethod ?? null },
      after_json: { submission_method: candidate.submissionMethod },
      confidence: "exact",
      ambiguity_reason: null,
    });
  }

  // Q&A clarifications — conflict with baseline requirement → ambiguous
  for (const qa of candidate.qaPairs ?? []) {
    const qNorm = normalizeText(qa.question);
    const aNorm = normalizeText(qa.answer);
    const conflicting = baseReqs.filter((r) => {
      const stmt = normalizeText(r.statement);
      if (!aNorm || !stmt) return false;
      // Opposite polarity heuristics: "shall" vs "shall not", "required" vs "not required"
      const flips =
        (/\bshall not\b/.test(aNorm) && /\bshall\b/.test(stmt) && !/\bshall not\b/.test(stmt)) ||
        (/\bnot required\b/.test(aNorm) && /\brequired\b/.test(stmt) && !/\bnot required\b/.test(stmt)) ||
        (/\bno longer\b/.test(aNorm) && stmt.length > 20);
      return flips && (stmt.slice(0, 30) === qNorm.slice(0, 30) || qNorm.includes(stmt.slice(0, 24)));
    });

    if (conflicting.length > 0) {
      pushItem(items, {
        change_type: "Q_A_CLARIFICATION",
        fingerprint: fingerprint(["qa", "conflict", qa.question, qa.answer]),
        target_table: "requirements",
        target_id: conflicting[0]?.id ?? null,
        before_text: conflicting.map((c) => c.statement).join(" || "),
        after_text: `Q: ${qa.question}\nA: ${qa.answer ?? ""}`,
        before_json: { requirement_ids: conflicting.map((c) => c.id) },
        after_json: { question: qa.question, answer: qa.answer ?? null, section_ref: qa.section_ref ?? null },
        confidence: "ambiguous",
        ambiguity_reason: "Q&A answer appears to conflict with an existing requirement — not auto-applied.",
        verification_status: "CONFLICT",
      });
    } else if (options?.triggerKind === "Q_AND_A" || options?.triggerKind === "CLARIFICATION" || qa.answer) {
      pushItem(items, {
        change_type: "Q_A_CLARIFICATION",
        fingerprint: fingerprint(["qa", qa.question, qa.answer]),
        target_table: "solicitation_q_and_a",
        target_id: null,
        before_text: null,
        after_text: `Q: ${qa.question}\nA: ${qa.answer ?? ""}`,
        before_json: null,
        after_json: { question: qa.question, answer: qa.answer ?? null, section_ref: qa.section_ref ?? null },
        confidence: "heuristic",
        ambiguity_reason: null,
      });
    }
  }

  return { items, summary: summarizeDetectedChanges(items) };
}

export function summarizeDetectedChanges(items: DetectedChangeItem[]): DetectChangesSummary {
  const by_type: Partial<Record<SolicitationChangeType, number>> = {};
  let matched = 0;
  let changed = 0;
  let added = 0;
  let removed = 0;
  let ambiguous = 0;

  for (const item of items) {
    by_type[item.change_type] = (by_type[item.change_type] ?? 0) + 1;
    if (item.ambiguity_reason || item.confidence === "ambiguous" || item.verification_status === "CONFLICT") {
      ambiguous += 1;
      continue;
    }
    if (item.change_type.endsWith("_ADDED") || item.change_type === "Q_A_CLARIFICATION") {
      if (item.change_type === "Q_A_CLARIFICATION" && item.before_text) changed += 1;
      else added += 1;
    } else if (item.change_type.endsWith("_REMOVED")) {
      removed += 1;
    } else if (
      item.change_type.endsWith("_MODIFIED") ||
      item.change_type === "DEADLINE_CHANGE" ||
      item.change_type === "PRICING_CHANGE" ||
      item.change_type.endsWith("_CHANGE")
    ) {
      changed += 1;
    } else {
      changed += 1;
    }
    if (item.target_id) matched += 1;
  }

  const unreviewed = items.filter(
    (i) => i.verification_status === "AI_EXTRACTED" || i.verification_status === "NEEDS_REVIEW",
  ).length;

  return {
    matched,
    changed,
    added,
    removed,
    ambiguous,
    unreviewed,
    by_type,
    detector_version: DETECTOR_VERSION,
    note: "Counts are heuristic detections awaiting human verify — not applied truth.",
  };
}
