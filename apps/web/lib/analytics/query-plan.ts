/**
 * Zod query plan for governed structured analytics.
 * The LLM (Ask) may propose metricId / dimensions / filters — never free SQL.
 */

import { z } from "zod";
import { getMetric, isForbiddenMetricId, listMetricIds } from "@/lib/analytics/semantic-model";

export const AnalyticsFilterSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]),
);

export const AnalyticsQueryPlanSchema = z
  .object({
    metricId: z.string().min(1),
    dimensions: z.array(z.string()).default([]),
    filters: AnalyticsFilterSchema.default({}),
    limit: z.number().int().min(1).max(500).default(100),
    question: z.string().optional(),
  })
  .superRefine((plan, ctx) => {
    if (isForbiddenMetricId(plan.metricId)) {
      ctx.addIssue({
        code: "custom",
        path: ["metricId"],
        message: `Metric "${plan.metricId}" is forbidden. market_share is never registered.`,
      });
      return;
    }
    const metric = getMetric(plan.metricId);
    if (!metric) {
      ctx.addIssue({
        code: "custom",
        path: ["metricId"],
        message: `Unknown metric "${plan.metricId}". Known: ${listMetricIds().join(", ")}.`,
      });
      return;
    }
    for (const dim of plan.dimensions) {
      if (!metric.dimensions.includes(dim) && dim !== "none") {
        ctx.addIssue({
          code: "custom",
          path: ["dimensions"],
          message: `Dimension "${dim}" is not eligible for metric ${metric.id}. Eligible: ${metric.dimensions.join(", ") || "(none)"}.`,
        });
      }
    }
  });

export type AnalyticsQueryPlan = z.infer<typeof AnalyticsQueryPlanSchema>;

export function parseAnalyticsQueryPlan(input: unknown):
  | { ok: true; plan: AnalyticsQueryPlan }
  | { ok: false; message: string } {
  const parsed = AnalyticsQueryPlanSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join("; ") || "Invalid query plan.";
    return { ok: false, message };
  }
  return { ok: true, plan: parsed.data };
}
