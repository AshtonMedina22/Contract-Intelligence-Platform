/**
 * Execute a governed analytics plan via PostgREST (user RLS).
 * Persists analytical_runs when orgId is known. Never runs free SQL.
 */

import { buildAnalyticsQuery, type PostgrestFetchSpec } from "@/lib/analytics/build-query";
import {
  computeAwardedValue,
  computeCompetitorFrequency,
  computeContractExpirationCount,
  computeMedianAwardedRate,
  computeOutcomeCount,
  computePursuitCount,
  computeRecompeteWinRate,
  computeSubmittedCount,
  computeWinRateDecided,
  withheldMetricResult,
  type ComputeResult,
} from "@/lib/analytics/compute";
import { parseAnalyticsQueryPlan, type AnalyticsQueryPlan } from "@/lib/analytics/query-plan";
import { resolveAnalyticsQuestion } from "@/lib/analytics/resolve-question";
import { validateSql } from "@/lib/analytics/validate-sql";
import {
  collectSourceFactIds,
  loadSourceFactClassifications,
} from "@/lib/classification/source-filter";
import type { DataClassification } from "@/lib/classification/types";
import { DEFAULT_ANALYTICS_CLASSIFICATION_POLICY } from "@/lib/analytics/semantic-model";

export type AnalyticsResultContract = {
  ok: boolean;
  question: string | null;
  metricId: string | null;
  metricInterpretation: string;
  scope: string;
  columns: Array<{ key: string; label: string }>;
  rows: Record<string, unknown>[];
  planFingerprint: string | null;
  explain: string[];
  limitations: string[];
  dataCutoff: string;
  status: ComputeResult["status"] | "refused_plan" | "refused_sql" | "error";
  refusedMessage: string | null;
  runId: string | null;
};

export type AnalyticsSupabase = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

async function runFetch(
  supabase: AnalyticsSupabase,
  spec: PostgrestFetchSpec,
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from(spec.table).select(spec.select);
  for (const f of spec.filters) {
    if (f.op === "eq") q = q.eq(f.column, f.value);
    else if (f.op === "in") q = q.in(f.column, f.value as unknown[]);
    else if (f.op === "gte") q = q.gte(f.column, f.value);
    else if (f.op === "lte") q = q.lte(f.column, f.value);
    else if (f.op === "not_null") q = q.not(f.column, "is", null);
    else if (f.op === "or") q = q.or(String(f.value));
  }
  if (spec.order) q = q.order(spec.order.column, { ascending: spec.order.ascending });
  const { data, error } = await q.limit(spec.limit);
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as Record<string, unknown>[], error: null };
}

function dataCutoffIso(): string {
  return new Date().toISOString();
}

function baseRefuse(message: string, question: string | null): AnalyticsResultContract {
  return {
    ok: false,
    question,
    metricId: null,
    metricInterpretation: message,
    scope: "none",
    columns: [],
    rows: [],
    planFingerprint: null,
    explain: [],
    limitations: [message],
    dataCutoff: dataCutoffIso(),
    status: "refused_plan",
    refusedMessage: message,
    runId: null,
  };
}

async function persistRun(
  supabase: AnalyticsSupabase,
  opts: {
    organizationId: string;
    userId: string | null;
    question: string | null;
    plan: AnalyticsQueryPlan;
    fingerprint: string;
    explain: string[];
    result: ComputeResult;
    dataCutoff: string;
  },
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("analytical_runs")
      .insert({
        organization_id: opts.organizationId,
        created_by: opts.userId,
        question: opts.question,
        metric_id: opts.plan.metricId,
        plan: opts.plan,
        plan_fingerprint: opts.fingerprint,
        explain: opts.explain,
        status: opts.result.status,
        columns: opts.result.columns,
        rows: opts.result.rows,
        interpretation: opts.result.interpretation,
        limitations: opts.result.limitations,
        scope: opts.result.scope,
        data_cutoff: opts.dataCutoff,
      })
      .select("id")
      .single();
    if (error) return null;
    return (data as { id: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Full governed path: optional rawSql reject → resolve metric → validate plan →
 * build PostgREST fetches → compute → result contract (+ optional persist).
 */
export async function runStructuredAnalytics(opts: {
  supabase: AnalyticsSupabase;
  question?: string | null;
  metricId?: string | null;
  dimensions?: string[];
  filters?: Record<string, unknown>;
  limit?: number;
  rawSql?: string | null;
  organizationId?: string | null;
  userId?: string | null;
  persist?: boolean;
  /** Explicit test-only override. Product/Ask callers omit this. */
  classificationPurpose?: "DEFAULT" | "DEMO_TEST";
}): Promise<AnalyticsResultContract> {
  const question = opts.question?.trim() || null;

  const sqlCheck = validateSql(opts.rawSql);
  if (!sqlCheck.ok) {
    return {
      ...baseRefuse(`Raw SQL rejected: ${sqlCheck.reason}`, question),
      status: "refused_sql",
    };
  }
  if (opts.rawSql && String(opts.rawSql).trim()) {
    // Even a "valid" SELECT is refused — F6 never executes free SQL.
    return {
      ...baseRefuse(
        "Free-form SQL is not executed. Use a registered metricId; the query builder runs PostgREST under RLS.",
        question,
      ),
      status: "refused_sql",
    };
  }

  const resolved = resolveAnalyticsQuestion({
    question,
    metricId: opts.metricId,
  });
  if (!resolved.ok) {
    return baseRefuse(resolved.message, question);
  }

  const planInput = {
    metricId: resolved.metric.id,
    dimensions: opts.dimensions ?? [],
    filters: opts.filters ?? {},
    limit: opts.limit ?? 100,
    question: question ?? undefined,
  };
  const parsed = parseAnalyticsQueryPlan(planInput);
  if (!parsed.ok) {
    return baseRefuse(parsed.message, question);
  }
  const plan = parsed.plan;

  if (resolved.metric.support === "withhold" || resolved.metric.support === "refuse") {
    const withheld = withheldMetricResult(
      resolved.metric.id,
      resolved.metric.withholdReason ?? "Metric unsupported.",
    );
    const built = buildAnalyticsQuery(plan);
    const fingerprint = "error" in built ? null : built.fingerprint;
    const explain = "error" in built ? [] : built.explain;
    let runId: string | null = null;
    if (opts.persist !== false && opts.organizationId && !("error" in built)) {
      runId = await persistRun(opts.supabase, {
        organizationId: opts.organizationId,
        userId: opts.userId ?? null,
        question,
        plan,
        fingerprint: built.fingerprint,
        explain: built.explain,
        result: withheld,
        dataCutoff: dataCutoffIso(),
      });
    }
    return {
      ok: true,
      question,
      metricId: plan.metricId,
      metricInterpretation: withheld.interpretation,
      scope: withheld.scope,
      columns: withheld.columns,
      rows: withheld.rows,
      planFingerprint: fingerprint,
      explain,
      limitations: withheld.limitations,
      dataCutoff: dataCutoffIso(),
      status: withheld.status,
      refusedMessage: null,
      runId,
    };
  }

  const built = buildAnalyticsQuery(plan);
  if ("error" in built) {
    return baseRefuse(built.error, question);
  }

  const fetched: Record<string, Record<string, unknown>[]> = {};
  for (const spec of built.fetches) {
    const { rows, error } = await runFetch(opts.supabase, spec);
    if (error) {
      return {
        ...baseRefuse(`Query failed on ${spec.table}: ${error}`, question),
        status: "error",
        metricId: plan.metricId,
        planFingerprint: built.fingerprint,
        explain: built.explain,
      };
    }
    fetched[spec.table] = rows;
  }

  if (opts.classificationPurpose !== "DEMO_TEST") {
    const sourceIds = [
      ...new Set(
        built.fetches.flatMap((spec) =>
          collectSourceFactIds(
            fetched[spec.table] ?? [],
            spec.classificationSourceFields ?? [],
          ),
        ),
      ),
    ];
    const factClassifications = await loadSourceFactClassifications(
      opts.supabase as Parameters<typeof loadSourceFactClassifications>[0],
      sourceIds,
    );

    const opportunityIds = [
      ...new Set(
        built.fetches.flatMap((spec) => {
          if (!spec.classificationOpportunityField) return [];
          return (fetched[spec.table] ?? [])
            .map((row) => row[spec.classificationOpportunityField!])
            .filter((id): id is string => typeof id === "string" && id.length > 0);
        }),
      ),
    ];
    const classificationsByOpportunity = new Map<string, DataClassification[]>();
    if (opportunityIds.length) {
      const { data: documentRows } = await opts.supabase
        .from("documents")
        .select("opportunity_id, data_classification")
        .in("opportunity_id", opportunityIds);
      for (const row of (documentRows ?? []) as Array<{
        opportunity_id?: string | null;
        data_classification?: DataClassification;
      }>) {
        if (!row.opportunity_id || !row.data_classification) continue;
        const classes = classificationsByOpportunity.get(row.opportunity_id) ?? [];
        classes.push(row.data_classification);
        classificationsByOpportunity.set(row.opportunity_id, classes);
      }
    }
    const demoOnlyOpportunityIds = new Set(
      [...classificationsByOpportunity.entries()]
        .filter(([, classes]) => classes.length > 0 && classes.every((c) => c === "illustrative_demo"))
        .map(([id]) => id),
    );

    for (const spec of built.fetches) {
      const fields = spec.classificationSourceFields ?? [];
      fetched[spec.table] = (fetched[spec.table] ?? []).filter((row) => {
        if (spec.classificationOpportunityField) {
          const opportunityId = row[spec.classificationOpportunityField];
          if (
            typeof opportunityId === "string" &&
            demoOnlyOpportunityIds.has(opportunityId)
          ) {
            return false;
          }
        }
        const rowSourceIds = fields
          .map((field) => row[field])
          .filter((id): id is string => typeof id === "string" && id.length > 0);
        if (!rowSourceIds.length) return true;
        const known = rowSourceIds
          .map((id) => factClassifications.get(id))
          .filter((value): value is DataClassification => Boolean(value));
        return known.length === 0 || known.some((value) => value !== "illustrative_demo");
      });
    }
  }

  let computed: ComputeResult;
  switch (plan.metricId) {
    case "pursuit_count":
      computed = computePursuitCount(fetched.opportunities ?? [], plan.dimensions);
      break;
    case "submitted_count":
      computed = computeSubmittedCount(
        fetched.opportunities ?? [],
        fetched.submission_packets ?? [],
      );
      break;
    case "won_count":
      computed = computeOutcomeCount(fetched.win_loss_reviews ?? [], "WON");
      break;
    case "lost_count":
      computed = computeOutcomeCount(fetched.win_loss_reviews ?? [], "LOST");
      break;
    case "win_rate_decided":
      computed = computeWinRateDecided(fetched.win_loss_reviews ?? []);
      break;
    case "recompete_win_rate":
      computed = computeRecompeteWinRate(
        (fetched.opportunities ?? []) as Array<{
          id: string;
          rebid_from_contract_id?: string | null;
          rebid_from_opportunity_id?: string | null;
          win_loss_reviews?: { outcome?: string } | { outcome?: string }[] | null;
        }>,
      );
      break;
    case "awarded_value":
      computed = computeAwardedValue(
        (fetched.awards ?? []) as Array<{ amount_nte?: number | null }>,
      );
      break;
    case "median_awarded_rate":
      computed = computeMedianAwardedRate(
        (fetched.pricing_lines ?? []) as Array<{
          awarded_rate?: number | null;
          unit?: string | null;
        }>,
      );
      break;
    case "contract_expiration_count": {
      const windowRaw = plan.filters.window_days ?? plan.filters.windowDays;
      const windowDays =
        typeof windowRaw === "number"
          ? windowRaw
          : typeof windowRaw === "string"
            ? Number(windowRaw)
            : null;
      computed = computeContractExpirationCount(
        (fetched.contracts ?? []) as Array<{
          id: string;
          verified_end_on?: string | null;
          client_id?: string | null;
        }>,
        {
          windowDays: Number.isFinite(windowDays) ? windowDays : null,
          bucket: plan.filters.bucket != null ? String(plan.filters.bucket) : null,
          alertRows: fetched.contract_alerts as Array<{ bucket?: string }> | undefined,
        },
      );
      break;
    }
    case "competitor_frequency":
      computed = computeCompetitorFrequency(
        (fetched.competitor_bids ?? []) as Array<{
          competitor_id?: string | null;
          competitors?: { name?: string } | { name?: string }[] | null;
        }>,
      );
      break;
    default:
      computed = withheldMetricResult(plan.metricId, "No compute handler.");
  }
  computed = {
    ...computed,
    limitations: [
      ...computed.limitations,
      opts.classificationPurpose === "DEMO_TEST"
        ? "DEMO_TEST purpose explicitly included illustrative_demo rows."
        : DEFAULT_ANALYTICS_CLASSIFICATION_POLICY,
    ],
  };

  const cutoff = dataCutoffIso();
  let runId: string | null = null;
  if (opts.persist !== false && opts.organizationId) {
    runId = await persistRun(opts.supabase, {
      organizationId: opts.organizationId,
      userId: opts.userId ?? null,
      question,
      plan,
      fingerprint: built.fingerprint,
      explain: built.explain,
      result: computed,
      dataCutoff: cutoff,
    });
  }

  return {
    ok: true,
    question,
    metricId: plan.metricId,
    metricInterpretation: computed.interpretation,
    scope: computed.scope,
    columns: computed.columns,
    rows: computed.rows,
    planFingerprint: built.fingerprint,
    explain: built.explain,
    limitations: computed.limitations,
    dataCutoff: cutoff,
    status: computed.status,
    refusedMessage: null,
    runId,
  };
}
