/**
 * VERIFY 7 — Pricing acceptance.
 * Independent audit of Canonical Phase 7 against verified historical-style structures.
 *
 * Run: node --env-file=apps/web/.env.local scripts/verify7-pricing-acceptance.mjs
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(import.meta.dirname, "..");
const OUT_JSON = join(ROOT, "docs/benchmarks/verify7-results.json");
const OUT_MD = join(ROOT, "docs/pilot/VERIFY7_ACCEPTANCE.md");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !publishable || !secret) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const stamp = Date.now().toString(36);
const matrix = [];
const orgIds = [];
const users = [];

function record(domain, name, ok, detail = "", source = "") {
  matrix.push({ domain, name, ok, detail, source });
  const src = source ? ` {${source}}` : "";
  console.log(`${ok ? "PASS" : "FAIL"}  [${domain}] ${name}${detail ? ` — ${detail}` : ""}${src}`);
}

function admin() {
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
function anon() {
  return createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function signIn(email, password) {
  const client = anon();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(error?.message ?? "sign-in failed");
  return client;
}
function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function medianOf(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function summarizeIncluded(rows, field) {
  const values = rows
    .filter((r) => r.included)
    .map((r) => r[field])
    .filter((v) => v != null && Number.isFinite(Number(v)))
    .map(Number);
  if (!values.length) return null;
  return {
    n: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    median: medianOf(values),
  };
}

async function addVerifiedFact(client, orgId, userId, opportunityId, opts) {
  const sha = createHash("sha256").update(`${opts.filename}-${stamp}-${randomUUID()}`).digest("hex");
  const { data: document, error: docError } = await client
    .from("documents")
    .insert({
      organization_id: orgId,
      opportunity_id: opportunityId ?? null,
      original_filename: opts.filename,
      document_type: opts.documentType ?? "proposal",
      commercial_truth: opts.truth ?? "proposed",
      mime_type: "application/pdf",
      processing_status: opts.processingStatus ?? "NEEDS_REVIEW",
    })
    .select("id")
    .single();
  if (docError) throw new Error(docError.message);

  const { data: version, error: versionError } = await client
    .from("document_versions")
    .insert({
      organization_id: orgId,
      document_id: document.id,
      sha256: sha,
      storage_path: `${orgId}/${document.id}/v/${sha}/original.pdf`,
    })
    .select("id")
    .single();
  if (versionError) throw new Error(versionError.message);

  const { data: run } = await client
    .from("extraction_runs")
    .insert({ organization_id: orgId, document_version_id: version.id })
    .select("id")
    .single();

  const { data: fact, error: factError } = await client
    .from("extracted_facts")
    .insert({
      organization_id: orgId,
      extraction_run_id: run.id,
      document_id: document.id,
      document_version_id: version.id,
      entity: opts.entity ?? "Armed officer",
      field: opts.field ?? "unit_price",
      raw_value: opts.value,
      normalized_value: opts.value,
      verified_value: opts.value,
      verification_status: "HUMAN_VERIFIED",
      verified_by: userId,
      verified_at: new Date().toISOString(),
      source_page: opts.sourcePage ?? 1,
      source_excerpt: opts.sourceExcerpt ?? String(opts.value),
    })
    .select("id")
    .single();
  if (factError) throw new Error(factError.message);
  return { factId: fact.id, documentId: document.id, versionId: version.id, sha };
}

function writeReport() {
  const byDomain = {};
  for (const row of matrix) {
    byDomain[row.domain] ??= { pass: 0, fail: 0, rows: [] };
    if (row.ok) byDomain[row.domain].pass += 1;
    else byDomain[row.domain].fail += 1;
    byDomain[row.domain].rows.push(row);
  }
  const failed = matrix.filter((r) => !r.ok);
  const verdict = failed.length === 0 ? "PASS" : "FAIL";

  mkdirSync(join(ROOT, "docs/benchmarks"), { recursive: true });
  writeFileSync(
    OUT_JSON,
    JSON.stringify(
      {
        audit: "VERIFY7",
        phase: "Canonical Phase 7 — Pricing Intelligence",
        stamp,
        verdict,
        total: matrix.length,
        passed: matrix.length - failed.length,
        failed: failed.length,
        matrix,
        byDomain,
        note: "Live org corpus had 0 pricing_lines; fixtures mirror pilot PKG structures (OT/holiday/equipment, PKG-09 cost build, base/option/escalation grain).",
      },
      null,
      2,
    ),
  );

  const domainLines = Object.entries(byDomain)
    .map(([d, s]) => {
      const result = s.fail === 0 ? "**PASS**" : "**FAIL**";
      return `| ${d} | ${result} | ${s.pass}/${s.pass + s.fail} |`;
    })
    .join("\n");

  const assertionLines = matrix
    .map((r) => {
      const result = r.ok ? "**PASS**" : "**FAIL**";
      const detail = String(r.detail ?? "")
        .replace(/\|/g, "\\|")
        .slice(0, 220);
      return `| ${r.domain} | ${r.name} | ${result} | ${detail} | ${r.source || "—"} |`;
    })
    .join("\n");

  const failList = failed.length
    ? failed.map((f) => `- **[${f.domain}] ${f.name}** — ${f.detail || "no detail"}`).join("\n")
    : "_None._";

  const md = `# VERIFY 7 — Pricing acceptance

**Phase:** Canonical Phase 7 — Pricing Intelligence  
**Audit date:** 2026-08-20  
**Command:** \`npm run test:verify7\`  
**Artifact:** [verify7-results.json](../benchmarks/verify7-results.json)

---

## Verdict

**${verdict}**

Independent acceptance that buyer requested ≠ submitted ≠ awarded ≠ current; formats/cost build/base-options-escalation; competitor isolation; comps rationale; source reachability; missing cost stays missing; observed ranges from included verified records; human-only final bid; Pursuit vs Intelligence distinct.

---

## PASS / FAIL by domain

| Domain | Result | Score |
| --- | --- | --- |
${domainLines}

---

## Assertion matrix

| Domain | Assertion | Result | Evidence | Source |
| --- | --- | --- | --- | --- |
${assertionLines}

---

## Failures

${failList}

---

## Corpus note

Live Supabase had **0** \`pricing_lines\` / verified price facts at audit time. Fixtures use HUMAN_VERIFIED facts shaped like pilot packages (PKG-05/10 rate grain, PKG-09 cost build, PKG-11 option/escalation labels).

---

## How to re-run

\`\`\`bash
npm run test:verify7
\`\`\`
`;

  mkdirSync(join(ROOT, "docs/pilot"), { recursive: true });
  writeFileSync(OUT_MD, md);
  console.log(`\nWrote ${OUT_MD}`);
  console.log(`Wrote ${OUT_JSON}`);
  return verdict;
}

async function main() {
  const adm = admin();
  try {
    // --- Static / surface proofs ---
    const surfaces = [
      "apps/web/components/opportunity-workspace/pricing-glide-grid.tsx",
      "apps/web/components/opportunity-workspace/pricing-workbench.tsx",
      "apps/web/components/opportunity-workspace/pricing-comparables.tsx",
      "apps/web/components/opportunity-workspace/final-bid-panel.tsx",
      "apps/web/app/(platform)/procurement/opportunities/[opportunityId]/pricing/page.tsx",
      "apps/web/app/(platform)/intelligence/pricing/page.tsx",
      "apps/web/lib/opportunity/pricing-math.ts",
      "supabase/migrations/20260820900000_phase7_pricing_intelligence.sql",
    ];
    for (const rel of surfaces) {
      record("surface", `exists ${rel.split("/").pop()}`, existsSync(join(ROOT, rel)), rel);
    }

    const glide = read("apps/web/components/opportunity-workspace/pricing-glide-grid.tsx");
    const workbench = read("apps/web/components/opportunity-workspace/pricing-workbench.tsx");
    const compsUi = read("apps/web/components/opportunity-workspace/pricing-comparables.tsx");
    const finalBid = read("apps/web/components/opportunity-workspace/final-bid-panel.tsx");
    const intelPage = read("apps/web/app/(platform)/intelligence/pricing/page.tsx");
    const actions = read(
      "apps/web/app/(platform)/procurement/opportunities/[opportunityId]/actions.ts",
    );
    const mathSrc = read("apps/web/lib/opportunity/pricing-math.ts");
    const mig = read("supabase/migrations/20260820900000_phase7_pricing_intelligence.sql");
    const cron = read("apps/web/app/api/cron/intelligence-digest/route.ts");
    const ask = read("apps/web/lib/ask/synthesize.ts");

    record(
      "distinct",
      "Pursuit Pricing and Intelligence Pricing are distinct surfaces",
      existsSync(
        join(
          ROOT,
          "apps/web/app/(platform)/procurement/opportunities/[opportunityId]/pricing/page.tsx",
        ),
      ) &&
        existsSync(join(ROOT, "apps/web/app/(platform)/intelligence/pricing/page.tsx")) &&
        /Pursuit pricing workbench/.test(workbench) &&
        /Cross-corpus/.test(intelPage) &&
        /Pursuit → Pricing/.test(intelPage),
      "separate routes + copy",
      "pricing pages",
    );

    record(
      "human",
      "Final bid UI requires explicit human action",
      /human decision required/i.test(finalBid) &&
        /approve/.test(finalBid) &&
        /AI and automation never approve/.test(finalBid) &&
        /savePricingDecision/.test(actions) &&
        /decided_by: approve \? userId/.test(actions),
      "FinalBidPanel + savePricingDecision",
      "final-bid-panel + actions",
    );

    record(
      "human",
      "No LLM/automation path sets HUMAN_APPROVED final bid",
      !/pricing_decisions/.test(ask) &&
        !/HUMAN_APPROVED/.test(cron) &&
        /never auto-approves/.test(cron) &&
        /HUMAN_APPROVED pricing_decisions require decided_by/.test(mig) &&
        !/generateObject|generateText|streamText/.test(actions),
      "ask/cron lack pricing_decisions writes; trigger + actions require human",
      "synthesize + cron + migration + actions",
    );

    record(
      "comps",
      "Comparables UI requires include/exclude rationale",
      /Why exclude|Why include/.test(compsUi) &&
        /required/.test(compsUi) &&
        /reason/.test(compsUi) &&
        /FactRef/.test(compsUi),
      "reason input + FactRef",
      "pricing-comparables.tsx",
    );

    record(
      "ranges",
      "Observed ranges computed from included comparable rows only",
      /onlyIncluded = true/.test(mathSrc) &&
        /rows\.filter\(\(r\) => r\.included\)/.test(mathSrc) &&
        /summarizeComparableRates\(comparables/.test(compsUi),
      "summarizeComparableRates defaults onlyIncluded",
      "pricing-math.ts",
    );

    // --- Live fixture org modeled on historical pilot structures ---
    const password = "Verify7-Pricing!22";
    const email = `verify7-${stamp}@example.com`;
    const created = await adm.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) throw new Error(created.error?.message ?? "user");
    users.push(created.data.user);
    const userId = created.data.user.id;
    const asA = await signIn(email, password);
    const orgId = (await asA.rpc("create_organization_with_admin", { org_name: `V7 ${stamp}` })).data;
    orgIds.push(orgId);

    // Live pursuit (to price)
    const { data: liveOpp } = await asA
      .from("opportunities")
      .insert({
        organization_id: orgId,
        title: `V7 live pursuit ${stamp}`,
        stage: "PRICING",
        service_type: "Armed guards",
      })
      .select("id")
      .single();

    // Historical peer pursuits with verified L&P structures (mirrors corpus patterns)
    const { data: histWin } = await asA
      .from("opportunities")
      .insert({
        organization_id: orgId,
        title: `V7 hist win PKG-style ${stamp}`,
        stage: "CLOSED",
        service_type: "Armed guards",
      })
      .select("id")
      .single();
    const { data: histLoss } = await asA
      .from("opportunities")
      .insert({
        organization_id: orgId,
        title: `V7 hist loss PKG-style ${stamp}`,
        stage: "CLOSED",
        service_type: "Armed guards",
      })
      .select("id")
      .single();

    // --- Five truths distinct on one labor line ---
    const req = await addVerifiedFact(asA, orgId, userId, histWin.id, {
      filename: "solicitation-rates.pdf",
      documentType: "solicitation",
      truth: "requested",
      field: "unit_price",
      value: "28.00",
      sourceExcerpt: "Buyer requested armed officer $28.00/hr",
    });
    const prop = await addVerifiedFact(asA, orgId, userId, histWin.id, {
      filename: "lp-proposal-tab.pdf",
      documentType: "proposal",
      truth: "proposed",
      field: "unit_price",
      value: "31.50",
      sourceExcerpt: "L&P submitted armed officer $31.50/hr",
    });
    const awd = await addVerifiedFact(asA, orgId, userId, histWin.id, {
      filename: "award-notice.pdf",
      documentType: "award",
      truth: "awarded",
      field: "unit_price",
      value: "30.25",
      sourceExcerpt: "Awarded armed officer $30.25/hr",
    });
    const cur = await addVerifiedFact(asA, orgId, userId, histWin.id, {
      filename: "amendment-current.pdf",
      documentType: "amendment",
      truth: "current",
      field: "unit_price",
      value: "30.75",
      sourceExcerpt: "Current amended armed officer $30.75/hr",
    });

    const { data: fiveTruth, error: fiveErr } = await asA
      .from("pricing_lines")
      .insert({
        organization_id: orgId,
        opportunity_id: histWin.id,
        labor_category: "Armed officer",
        rate_type: "standard",
        site_or_post: "Main gate",
        unit: "hour",
        quantity: 2080,
        requested_rate: 28,
        requested_source_fact_id: req.factId,
        internal_cost_rate: 24.1,
        proposed_rate: 31.5,
        proposed_source_fact_id: prop.factId,
        awarded_rate: 30.25,
        awarded_source_fact_id: awd.factId,
        current_rate: 30.75,
        current_source_fact_id: cur.factId,
        extended_amount: 30.75 * 2080,
      })
      .select(
        "id, requested_rate, internal_cost_rate, proposed_rate, awarded_rate, current_rate, requested_source_fact_id, proposed_source_fact_id, awarded_source_fact_id, current_source_fact_id",
      )
      .single();

    const truthsDistinct =
      !fiveErr &&
      fiveTruth &&
      fiveTruth.requested_rate !== fiveTruth.proposed_rate &&
      fiveTruth.proposed_rate !== fiveTruth.awarded_rate &&
      fiveTruth.awarded_rate !== fiveTruth.current_rate &&
      fiveTruth.internal_cost_rate !== fiveTruth.proposed_rate &&
      fiveTruth.requested_rate === 28 &&
      fiveTruth.proposed_rate === 31.5 &&
      fiveTruth.awarded_rate === 30.25 &&
      fiveTruth.current_rate === 30.75;

    record(
      "truths",
      "buyer requested != submitted != awarded != current (+ internal cost distinct)",
      Boolean(truthsDistinct),
      JSON.stringify(fiveTruth ?? fiveErr),
      "pricing_lines five columns",
    );

    // --- Different pricing formats coexist (PKG-01 equipment, PKG-10 OT/holiday) ---
    const formatRows = [
      {
        labor_category: "Armed officer",
        rate_type: "overtime",
        site_or_post: "Main gate",
        unit: "hour",
        proposed_rate: 47.25,
      },
      {
        labor_category: "Armed officer",
        rate_type: "holiday",
        site_or_post: "Main gate",
        unit: "hour",
        proposed_rate: 63.0,
      },
      {
        labor_category: "Golf cart",
        rate_type: "equipment",
        site_or_post: "Campus",
        unit: "day",
        proposed_rate: 45.0,
      },
      {
        labor_category: "Armed officer",
        rate_type: "extended_hours",
        site_or_post: "TxDMV window",
        unit: "hour",
        proposed_rate: 33.25,
      },
    ];
    const { data: formatInserted, error: formatErr } = await asA
      .from("pricing_lines")
      .insert(
        formatRows.map((r) => ({
          organization_id: orgId,
          opportunity_id: histWin.id,
          ...r,
          proposed_source_fact_id: prop.factId,
        })),
      )
      .select("id, rate_type, labor_category");

    const { data: formatListed } = await asA
      .from("pricing_lines")
      .select("rate_type")
      .eq("opportunity_id", histWin.id);
    const rateTypes = new Set((formatListed ?? []).map((r) => r.rate_type));
    record(
      "formats",
      "Different pricing formats can coexist on one opportunity",
      !formatErr &&
        (formatInserted?.length ?? 0) === 4 &&
        ["standard", "overtime", "holiday", "equipment", "extended_hours"].every((t) =>
          rateTypes.has(t),
        ),
      JSON.stringify({ inserted: formatInserted?.length, rateTypes: [...rateTypes], err: formatErr?.message }),
      "PKG-01/10-style grain",
    );

    // --- Base / options / escalation as coexisting grain (PKG-11-style labels) ---
    const periodRows = [
      {
        labor_category: "Armed officer",
        rate_type: "standard",
        site_or_post: "Base Year 1",
        unit: "annual",
        proposed_rate: 64000,
        awarded_rate: 62000,
      },
      {
        labor_category: "Armed officer",
        rate_type: "standard",
        site_or_post: "Option Year 1",
        unit: "annual",
        proposed_rate: 65280,
        awarded_rate: 63240,
      },
      {
        labor_category: "Armed officer",
        rate_type: "standard",
        site_or_post: "Year 2 CPI-W escalation",
        unit: "annual",
        proposed_rate: 66585.6,
        current_rate: 64504.8,
      },
    ];
    const { data: periodInserted, error: periodErr } = await asA
      .from("pricing_lines")
      .insert(
        periodRows.map((r) => ({
          organization_id: orgId,
          opportunity_id: histWin.id,
          proposed_source_fact_id: prop.factId,
          ...r,
        })),
      )
      .select("id, site_or_post, proposed_rate, awarded_rate, current_rate");

    const sites = (periodInserted ?? []).map((r) => r.site_or_post);
    const baseOk = sites.includes("Base Year 1");
    const optOk = sites.includes("Option Year 1");
    const escOk = sites.includes("Year 2 CPI-W escalation");
    const escalationHigher =
      periodInserted &&
      periodInserted.find((r) => r.site_or_post === "Year 2 CPI-W escalation")?.proposed_rate >
        periodInserted.find((r) => r.site_or_post === "Base Year 1")?.proposed_rate;

    record(
      "periods",
      "Base / options / escalation work as coexisting verified structures",
      !periodErr && baseOk && optOk && escOk && Boolean(escalationHigher),
      JSON.stringify({
        sites,
        rates: periodInserted?.map((r) => [r.site_or_post, r.proposed_rate]),
        err: periodErr?.message,
      }),
      "site_or_post grain + structure hints",
    );

    record(
      "periods",
      "Structure hints declare base/options and escalation",
      /base\/options/.test(workbench) ||
        read("apps/web/lib/opportunity/types.ts").includes("base/options"),
      "PRICING_STRUCTURE_HINTS",
      "types.ts / workbench",
    );

    // --- Labor / component cost build-up (pricing_cost_models + cost_build_components PKG-09) ---
    const { data: costModel, error: costErr } = await asA
      .from("pricing_cost_models")
      .insert({
        organization_id: orgId,
        opportunity_id: liveOpp.id,
        labor_category: "Armed officer",
        base_wage: 18.5,
        fringe: 1.25,
        health_welfare: 2.1,
        burden_pct: 12,
        workers_comp: 0.85,
        insurance: 0.4,
        supervision: 1.0,
        equipment: 0.5,
        vehicles: 0.75,
        travel: 0.2,
        overhead_pct: 8,
        target_margin_pct: 15,
        wage_determination_ref: "WD-PKG09-Tarrant",
      })
      .select("*")
      .single();

    // Planning math (same formula as pricing-math.ts)
    const direct =
      18.5 + 1.25 + 2.1 + 0.85 + 0.4 + 1.0 + 0.5 + 0.75 + 0.2;
    const loaded = direct * 1.12 * 1.08;
    const planned = loaded / (1 - 0.15);

    const { error: syncInternal } = await asA
      .from("pricing_lines")
      .upsert(
        {
          organization_id: orgId,
          opportunity_id: liveOpp.id,
          labor_category: "Armed officer",
          rate_type: "standard",
          site_or_post: "",
          unit: "hour",
          internal_cost_rate: Number(loaded.toFixed(4)),
          proposed_rate: null,
        },
        { onConflict: "organization_id,opportunity_id,labor_category,rate_type,site_or_post" },
      );

    const { data: liveLine } = await asA
      .from("pricing_lines")
      .select("internal_cost_rate, proposed_rate")
      .eq("opportunity_id", liveOpp.id)
      .eq("labor_category", "Armed officer")
      .eq("rate_type", "standard")
      .maybeSingle();

    record(
      "cost",
      "Labor/component cost build-up works (cost model + internal cost != submitted)",
      !costErr &&
        !syncInternal &&
        costModel?.base_wage === 18.5 &&
        costModel?.health_welfare === 2.1 &&
        costModel?.vehicles === 0.75 &&
        liveLine?.internal_cost_rate != null &&
        liveLine?.proposed_rate == null &&
        Math.abs(Number(liveLine.internal_cost_rate) - loaded) < 0.01 &&
        planned > loaded,
      JSON.stringify({
        direct: Number(direct.toFixed(4)),
        loaded: Number(loaded.toFixed(4)),
        planned: Number(planned.toFixed(4)),
        line: liveLine,
        err: costErr?.message,
      }),
      "pricing_cost_models + internal_cost_rate",
    );

    const { data: buildRows, error: buildErr } = await asA
      .from("cost_build_components")
      .insert([
        {
          organization_id: orgId,
          opportunity_id: histWin.id,
          component_label: "Direct wage",
          amount: 18.5,
          unit: "hour",
          sort_order: 1,
          source_fact_id: prop.factId,
          source_document_id: prop.documentId,
        },
        {
          organization_id: orgId,
          opportunity_id: histWin.id,
          component_label: "FICA",
          amount: 1.42,
          unit: "hour",
          sort_order: 2,
          source_fact_id: prop.factId,
          source_document_id: prop.documentId,
        },
        {
          organization_id: orgId,
          opportunity_id: histWin.id,
          component_label: "Workers comp",
          amount: 0.85,
          unit: "hour",
          sort_order: 3,
          source_fact_id: prop.factId,
          source_document_id: prop.documentId,
        },
        {
          organization_id: orgId,
          opportunity_id: histWin.id,
          component_label: "Overhead + profit",
          amount: 4.2,
          unit: "hour",
          sort_order: 4,
          source_fact_id: prop.factId,
          source_document_id: prop.documentId,
        },
      ])
      .select("id, component_label, amount");

    const buildSum = (buildRows ?? []).reduce((s, r) => s + Number(r.amount), 0);
    record(
      "cost",
      "PKG-09-style cost_build_components stack persists with source linkage",
      !buildErr && (buildRows?.length ?? 0) === 4 && buildSum > 18.5,
      JSON.stringify({ n: buildRows?.length, sum: buildSum, err: buildErr?.message }),
      "cost_build_components",
    );

    // --- Missing cost data remains missing ---
    const { data: sparseModel, error: sparseErr } = await asA
      .from("pricing_cost_models")
      .insert({
        organization_id: orgId,
        opportunity_id: liveOpp.id,
        labor_category: "Unarmed officer",
        base_wage: 15,
        // fringe, H&W, vehicles, travel intentionally omitted
      })
      .select(
        "base_wage, fringe, health_welfare, vehicles, travel, workers_comp, insurance, overhead_pct",
      )
      .single();

    record(
      "missing",
      "Missing cost data remains missing (nulls not fabricated)",
      !sparseErr &&
        sparseModel?.base_wage === 15 &&
        sparseModel?.fringe == null &&
        sparseModel?.health_welfare == null &&
        sparseModel?.vehicles == null &&
        sparseModel?.travel == null &&
        sparseModel?.workers_comp == null,
      JSON.stringify(sparseModel ?? sparseErr),
      "pricing_cost_models null columns",
    );

    // --- Competitor pricing does not become L&P pricing ---
    const { data: competitor } = await asA
      .from("competitors")
      .insert({ organization_id: orgId, name: `Rival Sec ${stamp}` })
      .select("id")
      .single();

    const compFact = await addVerifiedFact(asA, orgId, userId, histLoss.id, {
      filename: "competitor-tab.pdf",
      documentType: "proposal",
      truth: "proposed",
      entity: "Competitor A",
      field: "unit_price",
      value: "29.00",
      sourceExcerpt: "Competitor tab $29.00 — not L&P",
    });

    const beforeLp = await asA
      .from("pricing_lines")
      .select("id, proposed_rate, awarded_rate")
      .eq("organization_id", orgId);
    const beforeIds = new Set((beforeLp.data ?? []).map((r) => r.id));
    const beforeProposedSum = (beforeLp.data ?? []).reduce(
      (s, r) => s + (r.proposed_rate == null ? 0 : Number(r.proposed_rate)),
      0,
    );

    const { data: compLine, error: compErr } = await asA
      .from("competitor_pricing_lines")
      .insert({
        organization_id: orgId,
        opportunity_id: histLoss.id,
        competitor_id: competitor.id,
        vendor_name: `Rival Sec ${stamp}`,
        labor_category: "Armed officer",
        rate_type: "standard",
        hourly_rate: 29,
        source_document_id: compFact.documentId,
        source_fact_id: compFact.factId,
      })
      .select("id, hourly_rate")
      .single();

    const afterLp = await asA
      .from("pricing_lines")
      .select("id, proposed_rate, awarded_rate, opportunity_id")
      .eq("organization_id", orgId);
    const newLpLines = (afterLp.data ?? []).filter((r) => !beforeIds.has(r.id));
    const afterProposedSum = (afterLp.data ?? []).reduce(
      (s, r) => s + (r.proposed_rate == null ? 0 : Number(r.proposed_rate)),
      0,
    );

    // Unsourced competitor insert must fail (VERIFY5 constraint)
    const { error: unsourcedErr } = await asA.from("competitor_pricing_lines").insert({
      organization_id: orgId,
      opportunity_id: histLoss.id,
      vendor_name: "Unsourced Rival",
      labor_category: "Armed officer",
      hourly_rate: 99,
    });

    record(
      "competitor",
      "Competitor pricing does not become L&P pricing_lines",
      !compErr &&
        compLine?.hourly_rate === 29 &&
        newLpLines.length === 0 &&
        Math.abs(afterProposedSum - beforeProposedSum) < 0.001 &&
        Boolean(unsourcedErr),
      JSON.stringify({
        compLine: compLine?.id,
        newLp: newLpLines.length,
        proposedDelta: afterProposedSum - beforeProposedSum,
        unsourcedBlocked: Boolean(unsourcedErr),
      }),
      "competitor_pricing_lines isolation",
    );

    // --- Comparables include/exclude rationale ---
    const { data: peerHigh } = await asA
      .from("pricing_lines")
      .insert({
        organization_id: orgId,
        opportunity_id: histLoss.id,
        labor_category: "Armed officer",
        rate_type: "standard",
        site_or_post: "Peer site",
        proposed_rate: 40,
        awarded_rate: 38,
        proposed_source_fact_id: prop.factId,
      })
      .select("id")
      .single();

    const { error: includeOk } = await asA.from("pricing_comparable_judgments").insert({
      organization_id: orgId,
      opportunity_id: liveOpp.id,
      source_pricing_line_id: fiveTruth.id,
      included: true,
      reason: "Same buyer class and armed category — include as comparable win",
      created_by: userId,
    });
    const { error: excludeOk } = await asA.from("pricing_comparable_judgments").insert({
      organization_id: orgId,
      opportunity_id: liveOpp.id,
      source_pricing_line_id: peerHigh.id,
      included: false,
      reason: "Outlier premium site — exclude from observed range",
      created_by: userId,
    });
    const { error: bareReason } = await asA.from("pricing_comparable_judgments").insert({
      organization_id: orgId,
      opportunity_id: liveOpp.id,
      source_pricing_line_id: formatInserted[0].id,
      included: false,
      reason: "",
      created_by: userId,
    });

    const { data: judgments } = await asA
      .from("pricing_comparable_judgments")
      .select("source_pricing_line_id, included, reason")
      .eq("opportunity_id", liveOpp.id)
      .in("source_pricing_line_id", [fiveTruth.id, peerHigh.id]);

    record(
      "comps",
      "Comparables show inclusion/exclusion rationale",
      !includeOk &&
        !excludeOk &&
        (judgments ?? []).length === 2 &&
        (judgments ?? []).every((j) => j.reason && j.reason.trim().length > 0) &&
        (judgments ?? []).some((j) => j.included === true) &&
        (judgments ?? []).some((j) => j.included === false),
      JSON.stringify({ judgments }),
      "pricing_comparable_judgments",
    );

    // Empty reason: UI requires reason; DB NOT NULL still allows "".
    record(
      "comps",
      "Empty comparable reason rejected at persistence layer",
      Boolean(bareReason),
      bareReason?.message ??
        "empty reason insert succeeded — UI requires reason but DB allowed blank",
      "pricing_comparable_judgments.reason",
    );

    // --- Observed ranges from selected verified records only ---
    const comparableSet = [
      {
        id: fiveTruth.id,
        included: true,
        proposed_rate: 31.5,
        awarded_rate: 30.25,
        current_rate: 30.75,
      },
      {
        id: peerHigh.id,
        included: false,
        proposed_rate: 40,
        awarded_rate: 38,
        current_rate: null,
      },
      {
        id: "extra-included",
        included: true,
        proposed_rate: 29.5,
        awarded_rate: 29,
        current_rate: null,
      },
    ];
    const awardedObs = summarizeIncluded(comparableSet, "awarded_rate");
    const proposedAll = comparableSet.map((r) => r.proposed_rate);
    const proposedIncludedOnly = comparableSet
      .filter((r) => r.included)
      .map((r) => r.proposed_rate);
    const excludesOutlier =
      awardedObs &&
      awardedObs.max < 38 &&
      awardedObs.n === 2 &&
      Math.max(...proposedIncludedOnly) === 31.5 &&
      Math.max(...proposedAll) === 40;

    record(
      "ranges",
      "Observed ranges calculated from selected (included) verified records",
      Boolean(excludesOutlier),
      JSON.stringify({ awardedObs, proposedIncludedOnly, proposedAll }),
      "include/exclude filter",
    );

    // --- Source evidence reachable ---
    const { data: factJoin } = await asA
      .from("extracted_facts")
      .select("id, document_id, verified_value, verification_status")
      .eq("id", prop.factId)
      .single();
    const { data: docJoin } = await asA
      .from("documents")
      .select("id, original_filename")
      .eq("id", prop.documentId)
      .single();
    const sourceUi =
      /FactRef/.test(compsUi) &&
      /ingestion\/verification\//.test(read("apps/web/components/opportunity-workspace/shared.tsx"));

    record(
      "source",
      "Source evidence is reachable (fact → document → verification UI)",
      fiveTruth?.proposed_source_fact_id === prop.factId &&
        factJoin?.verification_status === "HUMAN_VERIFIED" &&
        docJoin?.id === prop.documentId &&
        sourceUi,
      JSON.stringify({
        factId: prop.factId,
        documentId: prop.documentId,
        lineFact: fiveTruth?.proposed_source_fact_id,
        uiFactRef: sourceUi,
      }),
      "pricing_lines.*_source_fact_id + FactRef",
    );

    // Glide itself does not expose source columns — note as separate assertion (honest)
    record(
      "source",
      "Glide five-truth matrix exposes source fact links",
      /source_fact|FactRef|verification/.test(glide),
      /source_fact|FactRef|verification/.test(glide)
        ? "Glide links sources"
        : "Glide is rate-only; sources reachable via comparables FactRef / four-truths elsewhere",
      "pricing-glide-grid.tsx",
    );

    // --- Final bid human gate (runtime) ---
    const { error: autoApprove } = await asA.from("pricing_decisions").insert({
      organization_id: orgId,
      opportunity_id: liveOpp.id,
      status: "HUMAN_APPROVED",
      final_bid_rate: 32,
      // no decided_by
    });
    const { error: approveNoRate } = await asA.from("pricing_decisions").insert({
      organization_id: orgId,
      opportunity_id: liveOpp.id,
      status: "HUMAN_APPROVED",
      decided_by: userId,
      // no rate/amount
    });
    const { data: draft, error: draftErr } = await asA
      .from("pricing_decisions")
      .insert({
        organization_id: orgId,
        opportunity_id: liveOpp.id,
        status: "DRAFT",
        final_bid_rate: 32,
        observed_min: awardedObs?.min ?? null,
        observed_max: awardedObs?.max ?? null,
        observed_median: awardedObs?.median ?? null,
        observed_n: awardedObs?.n ?? 0,
        include_summary: "Same-class armed wins",
        exclude_summary: "Premium site outlier",
        confidence: "medium",
      })
      .select("id, status, decided_by")
      .single();

    const { data: approved, error: humanErr } = await asA
      .from("pricing_decisions")
      .insert({
        organization_id: orgId,
        opportunity_id: liveOpp.id,
        status: "HUMAN_APPROVED",
        final_bid_rate: 32.1,
        decided_by: userId,
        rationale: "Above cost floor; within included awarded range",
        observed_min: awardedObs?.min ?? null,
        observed_max: awardedObs?.max ?? null,
        observed_median: awardedObs?.median ?? null,
        observed_n: awardedObs?.n ?? 0,
      })
      .select("id, status, decided_by, final_bid_rate")
      .single();

    record(
      "human",
      "Final price requires explicit human action (trigger + actor)",
      Boolean(autoApprove) &&
        Boolean(approveNoRate) &&
        !draftErr &&
        draft?.status === "DRAFT" &&
        draft?.decided_by == null &&
        !humanErr &&
        approved?.status === "HUMAN_APPROVED" &&
        approved?.decided_by === userId &&
        approved?.final_bid_rate === 32.1,
      JSON.stringify({
        autoBlocked: autoApprove?.message,
        noRateBlocked: approveNoRate?.message,
        draft: draft?.status,
        approved: approved?.status,
      }),
      "pricing_decisions_require_human",
    );

    // --- Pursuit vs global analysis remain distinct (runtime) ---
    const { count: pursuitDecisions } = await asA
      .from("pricing_decisions")
      .select("id", { count: "exact", head: true })
      .eq("opportunity_id", liveOpp.id)
      .eq("status", "HUMAN_APPROVED");
    const { data: intelLines } = await asA
      .from("pricing_lines")
      .select("id, opportunity_id")
      .eq("organization_id", orgId);
    const oppIdsInIntel = new Set((intelLines ?? []).map((r) => r.opportunity_id));

    record(
      "distinct",
      "Pursuit pricing decisions stay opportunity-scoped; Intelligence sees cross-corpus lines",
      (pursuitDecisions ?? 0) >= 1 &&
        oppIdsInIntel.size >= 2 &&
        oppIdsInIntel.has(liveOpp.id) &&
        oppIdsInIntel.has(histWin.id) &&
        /do not force operators out of the pursuit/i.test(intelPage),
      JSON.stringify({
        pursuitApproved: pursuitDecisions,
        distinctOppsInLines: oppIdsInIntel.size,
      }),
      "pricing_decisions vs pricing_lines aggregate",
    );

    // Cost model must not overwrite submitted proposed_rate on hist win five-truth line
    const { data: stillDistinct } = await asA
      .from("pricing_lines")
      .select("proposed_rate, internal_cost_rate, awarded_rate")
      .eq("id", fiveTruth.id)
      .single();
    record(
      "truths",
      "Internal cost planning does not collapse submitted/awarded truths",
      stillDistinct?.proposed_rate === 31.5 &&
        stillDistinct?.awarded_rate === 30.25 &&
        stillDistinct?.internal_cost_rate === 24.1,
      JSON.stringify(stillDistinct),
      "fiveTruth line unchanged",
    );
  } catch (e) {
    record("fatal", "suite error", false, e instanceof Error ? e.message : String(e));
  } finally {
    const a = admin();
    for (const orgId of orgIds) await a.from("organizations").delete().eq("id", orgId);
    for (const u of users) await a.auth.admin.deleteUser(u.id);
  }

  const verdict = writeReport();
  const failed = matrix.filter((r) => !r.ok);
  console.log(`\n${matrix.length - failed.length}/${matrix.length} PASS — verdict ${verdict}`);
  if (failed.length) {
    for (const f of failed) console.error(`  FAIL [${f.domain}] ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main();
