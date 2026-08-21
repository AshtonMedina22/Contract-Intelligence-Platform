import { createClient } from "@/lib/supabase/server";
import type {
  ActionCenterData,
  HomeKpi,
  AttentionItem,
  PipelinePursuit,
  WinLossSnapshot,
  ContractAlertBuckets,
  MarketSnapshot,
  HomeNotification,
} from "./types";

/**
 * Load all Action Center data via parallel Supabase queries.
 * All queries are RLS-scoped — returns only the user's org data.
 * No fake fallbacks or demo numbers.
 */
export async function loadActionCenter(): Promise<ActionCenterData> {
  const supabase = await createClient();

  // Refresh contract alerts before querying (same as renewals page)
  await supabase.rpc("refresh_contract_alerts");

  // F18: opportunity aggregates exclude only-demo packages. Classification is
  // independent from verification and procurement_packages.corpus_class.
  const { data: classifiedDocuments } = await supabase
    .from("documents")
    .select("opportunity_id, data_classification")
    .not("opportunity_id", "is", null);
  const opportunityClasses = new Map<string, Set<string>>();
  for (const row of classifiedDocuments ?? []) {
    if (!row.opportunity_id) continue;
    const classes = opportunityClasses.get(row.opportunity_id) ?? new Set<string>();
    classes.add(row.data_classification);
    opportunityClasses.set(row.opportunity_id, classes);
  }
  const demoOnlyOpportunityIds = [...opportunityClasses.entries()]
    .filter(([, classes]) => classes.size === 1 && classes.has("illustrative_demo"))
    .map(([id]) => id);
  const demoFilter =
    demoOnlyOpportunityIds.length > 0 ? `(${demoOnlyOpportunityIds.join(",")})` : null;

  let activePursuitsQuery = supabase
    .from("opportunities")
    .select("*", { count: "exact", head: true })
    .not("stage", "in", "(CLOSED,AWARDED)");
  let pursuitsDueSoonQuery = supabase
    .from("opportunities")
    .select("*", { count: "exact", head: true })
    .not("stage", "in", "(CLOSED,AWARDED)")
    .not("response_due_on", "is", null)
    .lte("response_due_on", new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
    .gte("response_due_on", new Date().toISOString().slice(0, 10));
  let pipelineQuery = supabase
    .from("opportunities")
    .select("id, title, stage, response_due_on, clients(name)")
    .not("stage", "in", "(CLOSED,AWARDED)")
    .order("response_due_on", { ascending: true, nullsFirst: false })
    .limit(20);
  let winLossCountsQuery = supabase.from("win_loss_reviews").select("outcome, opportunity_id");
  let recentOutcomesQuery = supabase
    .from("win_loss_reviews")
    .select("id, opportunity_id, outcome, winner_name, opportunities(title)")
    .order("created_at", { ascending: false })
    .limit(5);
  let duePursuitsQuery = supabase
    .from("opportunities")
    .select("id, title, response_due_on")
    .not("stage", "in", "(CLOSED,AWARDED)")
    .not("response_due_on", "is", null)
    .lte("response_due_on", new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
    .gte("response_due_on", new Date().toISOString().slice(0, 10))
    .order("response_due_on", { ascending: true })
    .limit(10);
  if (demoFilter) {
    activePursuitsQuery = activePursuitsQuery.not("id", "in", demoFilter);
    pursuitsDueSoonQuery = pursuitsDueSoonQuery.not("id", "in", demoFilter);
    pipelineQuery = pipelineQuery.not("id", "in", demoFilter);
    winLossCountsQuery = winLossCountsQuery.not("opportunity_id", "in", demoFilter);
    recentOutcomesQuery = recentOutcomesQuery.not("opportunity_id", "in", demoFilter);
    duePursuitsQuery = duePursuitsQuery.not("id", "in", demoFilter);
  }

  // Parallel queries for all metrics
  const [
    // KPI metrics
    activePursuitsRes,
    pursuitsDueSoonRes,
    verificationBacklogRes,
    processingFailuresRes,
    lifecycleErrorRes,
    openExceptionsRes,
    contractAlertsCountRes,
    lpInputRequiredRes,
    pricingDraftRes,
    approvalsRequestedRes,
    activeContractsRes,
    // Pipeline data
    pipelineRes,
    // Win/loss data
    winLossCountsRes,
    recentOutcomesRes,
    // Contract alerts by bucket
    alertBucketsRes,
    // Market data
    clientsRes,
    competitorsRes,
    // Due pursuits for attention queue
    duePursuitsRes,
    // Persisted notifications (F9)
    notificationsRes,
  ] = await Promise.all([
    // Active pursuits: stage NOT IN ('CLOSED', 'AWARDED')
    activePursuitsQuery,

    // Pursuits due within 14 days
    pursuitsDueSoonQuery,

    // Verification backlog: facts with AI_EXTRACTED, NEEDS_REVIEW, or CONFLICT
    supabase
      .from("extracted_facts")
      .select("*", { count: "exact", head: true })
      .in("verification_status", ["AI_EXTRACTED", "NEEDS_REVIEW", "CONFLICT"])
      .neq("data_classification", "illustrative_demo"),

    // Processing failures: documents with FAILED status
    supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("processing_status", "FAILED")
      .neq("data_classification", "illustrative_demo"),

    // Lifecycle errors: documents with lifecycle_error NOT NULL
    supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .not("lifecycle_error", "is", null)
      .neq("data_classification", "illustrative_demo"),

    // Open exceptions: validation_exceptions not resolved
    supabase
      .from("validation_exceptions")
      .select("*", { count: "exact", head: true })
      .eq("resolved", false),

    // Contract alerts count
    supabase.from("contract_alerts").select("*", { count: "exact", head: true }),

    // L&P INPUT REQUIRED: requirements with that status
    supabase
      .from("requirements")
      .select("*", { count: "exact", head: true })
      .eq("matrix_status", "L_AND_P_INPUT_REQUIRED"),

    // Pricing DRAFT decisions
    supabase
      .from("pricing_decisions")
      .select("*", { count: "exact", head: true })
      .eq("status", "DRAFT"),

    // Approvals requested: enabled layers with status = requested
    supabase
      .from("pursuit_approval_layers")
      .select("*", { count: "exact", head: true })
      .eq("enabled", true)
      .eq("status", "requested"),

    // Active contracts: contracts without EXPIRED alert bucket
    supabase
      .from("contracts")
      .select("id, contract_alerts(bucket)")
      .not("verified_end_on", "is", null),

    // Pipeline: active opportunities with stage, client, due date
    pipelineQuery,

    // Win/loss counts by outcome
    winLossCountsQuery,

    // Recent outcomes for list
    recentOutcomesQuery,

    // Contract alerts grouped by bucket
    supabase.from("contract_alerts").select("bucket"),

    // Client count
    supabase.from("clients").select("*", { count: "exact", head: true }),

    // Competitor count
    supabase.from("competitors").select("*", { count: "exact", head: true }),

    // Due pursuits for attention queue (due within 14 days)
    duePursuitsQuery,

    // Open notifications (org broadcast + own user)
    supabase
      .from("notifications")
      .select("id, title, body, deep_link, severity, channel, status, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  // Calculate KPI values
  const processingFailures =
    (processingFailuresRes.count ?? 0) + (lifecycleErrorRes.count ?? 0);

  // Calculate active contracts (those not EXPIRED)
  const allContractsWithAlerts = activeContractsRes.data ?? [];
  const activeContractCount = allContractsWithAlerts.filter((c) => {
    const alerts = Array.isArray(c.contract_alerts)
      ? c.contract_alerts
      : c.contract_alerts
        ? [c.contract_alerts]
        : [];
    return !alerts.some((a) => a.bucket === "EXPIRED");
  }).length;

  const kpi: HomeKpi = {
    activePursuits: activePursuitsRes.count ?? 0,
    pursuitsDueSoon: pursuitsDueSoonRes.count ?? 0,
    verificationBacklog: verificationBacklogRes.count ?? 0,
    processingFailures,
    openExceptions: openExceptionsRes.count ?? 0,
    contractsInReviewWindow: contractAlertsCountRes.count ?? 0,
    lpInputRequired: lpInputRequiredRes.count ?? null,
    pricingDraftDecisions: pricingDraftRes.count ?? null,
    approvalsRequested: approvalsRequestedRes.count ?? null,
    activeContracts: activeContractCount > 0 ? activeContractCount : null,
  };

  // Build attention queue
  const attentionItems = buildAttentionQueue({
    duePursuits: duePursuitsRes.data ?? [],
    verificationBacklog: kpi.verificationBacklog,
    processingFailures: kpi.processingFailures,
    openExceptions: kpi.openExceptions,
    contractAlerts: contractAlertsCountRes.count ?? 0,
    lpInputRequired: kpi.lpInputRequired ?? 0,
    pricingDrafts: kpi.pricingDraftDecisions ?? 0,
    approvalsRequested: kpi.approvalsRequested ?? 0,
  });

  // Build pipeline
  const pipeline: PipelinePursuit[] = (pipelineRes.data ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    return {
      id: row.id,
      title: row.title,
      stage: row.stage ?? "INTAKE",
      clientName: client?.name ?? null,
      responseDueOn: row.response_due_on,
      verifiedAmount: null, // No HUMAN_APPROVED amount column on opportunities - omit
    };
  });

  // Build win/loss snapshot
  const outcomes = winLossCountsRes.data ?? [];
  const outcomeCounts = outcomes.reduce(
    (acc, r) => {
      const o = r.outcome as string;
      acc[o] = (acc[o] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const recentOutcomes = (recentOutcomesRes.data ?? []).map((row) => {
    const opp = Array.isArray(row.opportunities)
      ? row.opportunities[0]
      : row.opportunities;
    return {
      id: row.id,
      opportunityId: row.opportunity_id,
      opportunityTitle: opp?.title ?? "Unknown",
      outcome: row.outcome,
      winnerName: row.winner_name,
    };
  });

  const winLoss: WinLossSnapshot = {
    wonCount: outcomeCounts["WON"] ?? 0,
    lostCount: outcomeCounts["LOST"] ?? 0,
    pendingCount: outcomeCounts["PENDING"] ?? 0,
    cancelledCount: outcomeCounts["CANCELLED"] ?? 0,
    noBidCount: outcomeCounts["NO_BID"] ?? 0,
    noAwardCount: outcomeCounts["NO_AWARD"] ?? 0,
    recentOutcomes,
  };

  // Build contract alert buckets
  const alertBuckets = (alertBucketsRes.data ?? []).reduce(
    (acc, r) => {
      const bucket = r.bucket as keyof ContractAlertBuckets;
      if (bucket in acc) {
        acc[bucket]++;
      }
      return acc;
    },
    { "180": 0, "120": 0, "90": 0, "60": 0, "30": 0, EXPIRED: 0 } as ContractAlertBuckets,
  );

  // Build market snapshot
  const market: MarketSnapshot = {
    clientCount: clientsRes.count ?? 0,
    competitorCount: competitorsRes.count ?? 0,
  };

  const notifications: HomeNotification[] = (notificationsRes.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    deepLink: row.deep_link,
    severity: row.severity ?? "info",
    channel: row.channel ?? "in_app",
    status: row.status ?? "open",
    createdAt: row.created_at,
  }));

  return {
    kpi,
    attentionItems,
    pipeline,
    winLoss,
    contractAlerts: alertBuckets,
    market,
    notifications,
  };
}

type AttentionInput = {
  duePursuits: Array<{ id: string; title: string; response_due_on: string | null }>;
  verificationBacklog: number;
  processingFailures: number;
  openExceptions: number;
  contractAlerts: number;
  lpInputRequired: number;
  pricingDrafts: number;
  approvalsRequested: number;
};

function buildAttentionQueue(input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];

  // Due pursuits - each becomes an item
  for (const pursuit of input.duePursuits) {
    const dueDate = pursuit.response_due_on
      ? new Date(pursuit.response_due_on)
      : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntil = dueDate
      ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    items.push({
      id: `pursuit-${pursuit.id}`,
      priority: daysUntil !== null && daysUntil <= 3 ? "urgent" : "high",
      category: "due_pursuit",
      title: pursuit.title,
      context:
        daysUntil === 0
          ? "Due today"
          : daysUntil === 1
            ? "Due tomorrow"
            : `Due in ${daysUntil} days`,
      href: `/procurement/opportunities/${pursuit.id}`,
    });
  }

  // Verification backlog
  if (input.verificationBacklog > 0) {
    items.push({
      id: "verification-backlog",
      priority: input.verificationBacklog > 50 ? "high" : "medium",
      category: "verification",
      title: "Verification backlog",
      context: `${input.verificationBacklog} fact${input.verificationBacklog === 1 ? "" : "s"} pending`,
      href: "/ingestion/verification",
    });
  }

  // Processing failures
  if (input.processingFailures > 0) {
    items.push({
      id: "processing-failures",
      priority: "high",
      category: "processing",
      title: "Processing failures",
      context: `${input.processingFailures} document${input.processingFailures === 1 ? "" : "s"} failed`,
      href: "/ingestion/processing",
    });
  }

  // Open exceptions
  if (input.openExceptions > 0) {
    items.push({
      id: "open-exceptions",
      priority: "medium",
      category: "exception",
      title: "Open exceptions",
      context: `${input.openExceptions} unresolved`,
      href: "/ingestion/exceptions",
    });
  }

  // Contract alerts (renewals)
  if (input.contractAlerts > 0) {
    items.push({
      id: "contract-renewals",
      priority: "medium",
      category: "renewal",
      title: "Contract renewals",
      context: `${input.contractAlerts} in review window`,
      href: "/contracts/renewals",
    });
  }

  // L&P Input Required
  if (input.lpInputRequired > 0) {
    items.push({
      id: "lp-input-required",
      priority: "high",
      category: "input_required",
      title: "L&P input required",
      context: `${input.lpInputRequired} requirement${input.lpInputRequired === 1 ? "" : "s"}`,
      href: "/procurement/opportunities",
    });
  }

  // Pricing drafts
  if (input.pricingDrafts > 0) {
    items.push({
      id: "pricing-drafts",
      priority: "medium",
      category: "pricing",
      title: "Pricing decisions",
      context: `${input.pricingDrafts} draft${input.pricingDrafts === 1 ? "" : "s"} awaiting approval`,
      href: "/procurement/opportunities",
    });
  }

  // Approvals requested
  if (input.approvalsRequested > 0) {
    items.push({
      id: "approvals-requested",
      priority: "high",
      category: "approval",
      title: "Approvals requested",
      context: `${input.approvalsRequested} pending`,
      href: "/procurement/opportunities",
    });
  }

  // Sort by priority
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return items;
}
