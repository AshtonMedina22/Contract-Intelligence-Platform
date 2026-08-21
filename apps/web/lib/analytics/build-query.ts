/**
 * Build a governed PostgREST query spec from a validated AnalyticsQueryPlan.
 * Never emits free SQL. Execution uses createClient() under user RLS.
 */

import { createHash } from "node:crypto";
import type { AnalyticsQueryPlan } from "@/lib/analytics/query-plan";
import { getMetric, type MetricDefinition } from "@/lib/analytics/semantic-model";

export type PostgrestFetchSpec = {
  table: string;
  select: string;
  filters: Array<{ op: "eq" | "in" | "gte" | "lte" | "not_null" | "or"; column: string; value?: unknown }>;
  order?: { column: string; ascending: boolean };
  limit: number;
};

export type BuiltQuery = {
  metric: MetricDefinition;
  plan: AnalyticsQueryPlan;
  fetches: PostgrestFetchSpec[];
  fingerprint: string;
  explain: string[];
};

function fingerprint(plan: AnalyticsQueryPlan): string {
  const payload = JSON.stringify({
    metricId: plan.metricId,
    dimensions: [...plan.dimensions].sort(),
    filters: plan.filters,
    limit: plan.limit,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 24);
}

function pushFilter(
  filters: PostgrestFetchSpec["filters"],
  plan: AnalyticsQueryPlan,
  columnMap: Record<string, string>,
) {
  for (const [key, value] of Object.entries(plan.filters)) {
    if (value == null || value === "") continue;
    const column = columnMap[key] ?? key;
    if (key === "date_from" || key === "from") {
      filters.push({ op: "gte", column: columnMap.date ?? column, value });
      continue;
    }
    if (key === "date_to" || key === "to") {
      filters.push({ op: "lte", column: columnMap.date ?? column, value });
      continue;
    }
    if (Array.isArray(value)) {
      filters.push({ op: "in", column, value });
    } else {
      filters.push({ op: "eq", column, value });
    }
  }
}

/**
 * Translate plan → PostgREST fetch specs. Aggregation happens in compute after fetch.
 */
export function buildAnalyticsQuery(plan: AnalyticsQueryPlan): BuiltQuery | { error: string } {
  const metric = getMetric(plan.metricId);
  if (!metric) return { error: `Unknown metric ${plan.metricId}` };

  const fp = fingerprint(plan);
  const explain: string[] = [
    `metric=${metric.id}`,
    `support=${metric.support}`,
    `grain=${metric.grain}`,
    `tables=${metric.tables.join(",")}`,
    `fingerprint=${fp}`,
  ];

  if (metric.support === "withhold" || metric.support === "refuse") {
    return {
      metric,
      plan,
      fetches: [],
      fingerprint: fp,
      explain: [...explain, `withheld=${metric.withholdReason ?? "unsupported"}`],
    };
  }

  const limit = plan.limit;
  let fetches: PostgrestFetchSpec[] = [];

  switch (metric.id) {
    case "pursuit_count": {
      const filters: PostgrestFetchSpec["filters"] = [];
      pushFilter(filters, plan, {
        stage: "stage",
        service_type: "service_type",
        client_id: "client_id",
        date: "created_at",
      });
      fetches = [
        {
          table: "opportunities",
          select: "id, stage, service_type, client_id, created_at, clients(name)",
          filters,
          limit,
        },
      ];
      break;
    }
    case "submitted_count": {
      fetches = [
        {
          table: "opportunities",
          select: "id, stage, service_type, client_id, created_at, clients(name)",
          filters: [{ op: "eq", column: "stage", value: "SUBMITTED" }],
          limit,
        },
        {
          table: "submission_packets",
          select: "id, opportunity_id, submitted_at",
          filters: [{ op: "not_null", column: "submitted_at" }],
          limit,
        },
      ];
      pushFilter(fetches[0]!.filters, plan, {
        service_type: "service_type",
        client_id: "client_id",
        date: "created_at",
      });
      break;
    }
    case "won_count":
    case "lost_count":
    case "win_rate_decided": {
      const filters: PostgrestFetchSpec["filters"] = [];
      if (metric.id === "won_count") filters.push({ op: "eq", column: "outcome", value: "WON" });
      if (metric.id === "lost_count") filters.push({ op: "eq", column: "outcome", value: "LOST" });
      pushFilter(filters, plan, { date: "updated_at", outcome: "outcome" });
      fetches = [
        {
          table: "win_loss_reviews",
          select:
            "id, opportunity_id, outcome, updated_at, opportunities(client_id, service_type, clients(name))",
          filters,
          limit: Math.max(limit, 500),
        },
      ];
      break;
    }
    case "recompete_win_rate": {
      fetches = [
        {
          table: "opportunities",
          select:
            "id, client_id, service_type, rebid_from_contract_id, rebid_from_opportunity_id, clients(name), win_loss_reviews(outcome, updated_at)",
          filters: [
            {
              op: "or",
              column: "rebid_from_contract_id,rebid_from_opportunity_id",
              value: "rebid_from_contract_id.not.is.null,rebid_from_opportunity_id.not.is.null",
            },
          ],
          limit: Math.max(limit, 500),
        },
      ];
      break;
    }
    case "awarded_value": {
      const filters: PostgrestFetchSpec["filters"] = [];
      pushFilter(filters, plan, { date: "awarded_on" });
      fetches = [
        {
          table: "awards",
          select: "id, amount_nte, awarded_on, opportunity_id, opportunities(client_id, clients(name))",
          filters,
          limit: Math.max(limit, 500),
        },
      ];
      break;
    }
    case "median_awarded_rate": {
      const filters: PostgrestFetchSpec["filters"] = [
        { op: "not_null", column: "awarded_rate" },
      ];
      pushFilter(filters, plan, {
        labor_category: "labor_category",
        unit: "unit",
        date: "updated_at",
      });
      fetches = [
        {
          table: "pricing_lines",
          select:
            "id, awarded_rate, unit, labor_category, opportunity_id, opportunities(client_id, clients(name))",
          filters,
          limit: Math.max(limit, 1000),
        },
      ];
      break;
    }
    case "contract_expiration_count": {
      const filters: PostgrestFetchSpec["filters"] = [
        { op: "not_null", column: "verified_end_on" },
      ];
      pushFilter(filters, plan, {
        client_id: "client_id",
        date: "verified_end_on",
        bucket: "bucket",
      });
      // Prefer contract_alerts when bucket filter present; else contracts by window.
      if (plan.filters.bucket != null) {
        fetches = [
          {
            table: "contract_alerts",
            select: "id, bucket, contract_id, contracts(id, client_id, verified_end_on, title, clients(name))",
            filters: [{ op: "eq", column: "bucket", value: String(plan.filters.bucket) }],
            limit,
          },
        ];
      } else {
        fetches = [
          {
            table: "contracts",
            select: "id, title, client_id, verified_end_on, clients(name)",
            filters,
            limit: Math.max(limit, 500),
          },
        ];
      }
      break;
    }
    case "competitor_frequency": {
      fetches = [
        {
          table: "competitor_bids",
          select: "id, competitor_id, opportunity_id, created_at, competitors(name)",
          filters: [],
          limit: Math.max(limit, 1000),
        },
      ];
      pushFilter(fetches[0]!.filters, plan, {
        competitor_id: "competitor_id",
        date: "created_at",
      });
      break;
    }
    default:
      return { error: `No builder for metric ${metric.id}` };
  }

  explain.push(`fetches=${fetches.map((f) => f.table).join("+")}`);
  return { metric, plan, fetches, fingerprint: fp, explain };
}
