/**
 * VERIFY 5 — Cross-corpus Intelligence acceptance.
 * Audits Intelligence against verified canonical records only.
 *
 * Run: node --env-file=apps/web/.env.local scripts/verify5-intelligence-acceptance.mjs
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(import.meta.dirname, "..");
const OUT_JSON = join(ROOT, "docs/benchmarks/verify5-results.json");
const OUT_MD = join(ROOT, "docs/pilot/VERIFY5_ACCEPTANCE.md");

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

async function addFact(client, orgId, userId, opportunityId, opts) {
  const sha = createHash("sha256").update(`${opts.filename}-${stamp}-${randomUUID()}`).digest("hex");
  const { data: document, error: docError } = await client
    .from("documents")
    .insert({
      organization_id: orgId,
      opportunity_id: opportunityId,
      client_id: opts.clientId ?? null,
      original_filename: opts.filename,
      document_type: opts.documentType ?? "award_letter",
      commercial_truth: opts.truth ?? "awarded",
      mime_type: "application/pdf",
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

  const verified = opts.status !== "AI_EXTRACTED";
  const { data: fact, error: factError } = await client
    .from("extracted_facts")
    .insert({
      organization_id: orgId,
      extraction_run_id: (
        await client
          .from("extraction_runs")
          .insert({ organization_id: orgId, document_version_id: version.id })
          .select("id")
          .single()
      ).data.id,
      document_id: document.id,
      document_version_id: version.id,
      entity: opts.entity ?? "document",
      field: opts.field,
      raw_value: opts.value,
      normalized_value: opts.value,
      verified_value: verified ? opts.value : null,
      verification_status: opts.status ?? "HUMAN_VERIFIED",
      verified_by: verified ? userId : null,
      verified_at: verified ? new Date().toISOString() : null,
      source_page: opts.sourcePage ?? null,
      source_excerpt: opts.sourceExcerpt ?? null,
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
        audit: "VERIFY5",
        phase: "Canonical Phase 5 — Intelligence",
        stamp,
        verdict,
        total: matrix.length,
        passed: matrix.length - failed.length,
        failed: failed.length,
        matrix,
        byDomain,
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
      const detail = String(r.detail ?? "").replace(/\|/g, "\\|").slice(0, 220);
      return `| ${r.domain} | ${r.name} | ${result} | ${detail} | ${r.source || "—"} |`;
    })
    .join("\n");

  const md = `# VERIFY 5 — Intelligence acceptance

**Phase:** Canonical Phase 5 — Buyer / Competitor / Market / Win-Loss Intelligence  
**Audit date:** 2026-08-20  
**Command:** \`npm run test:verify5\`  
**Artifact:** [verify5-results.json](../benchmarks/verify5-results.json)

---

## Verdict

**${verdict}**

Independent Intelligence acceptance against **verified canonical records only**. Raw document mentions must not become bids or awards. Market metrics must come from business records, not document counts. Reuse state is independent of win/loss outcome.

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

## Deferred / out of scope

- Phase 6 Ask GPT synthesis and AI report generators
- Inventing geography/services without evidence
- Market share from document corpus size

---

## How to re-run

\`\`\`bash
npm run test:verify5
\`\`\`
`;

  writeFileSync(OUT_MD, md);
  console.log(`\nWrote ${OUT_MD}`);
  console.log(`Wrote ${OUT_JSON}`);
  console.log(`\n${matrix.length - failed.length}/${matrix.length} PASS — verdict ${verdict}`);
  return verdict;
}

async function main() {
  const adm = admin();
  const password = "Verify5-Intel!22";
  const email = `verify5-${stamp}@example.com`;

  try {
    // --- Static honesty surfaces ---
    const marketSrc = read("apps/web/app/(platform)/intelligence/market/page.tsx");
    record(
      "market",
      "Market metrics exclude documents count",
      !/from\("documents"\)/.test(marketSrc) &&
        /from\("awards"\)/.test(marketSrc) &&
        /from\("win_loss_reviews"\)/.test(marketSrc) &&
        /from\("competitor_bids"\)/.test(marketSrc) &&
        /from\("pricing_lines"\)/.test(marketSrc),
      "awards/win_loss/bids/pricing_lines only",
      "market/page.tsx",
    );

    const buyersSrc = read("apps/web/app/(platform)/intelligence/clients/page.tsx");
    record(
      "buyer",
      "Buyers UI is procurement intelligence not CRM",
      /Not CRM|procurement intelligence/i.test(buyersSrc) && /loadBuyerPortfolio/.test(buyersSrc),
      "portfolio + research",
      "clients/page.tsx",
    );

    const overviewSrc = read(
      "apps/web/app/(platform)/procurement/opportunities/[opportunityId]/page.tsx",
    );
    record(
      "pursuit",
      "Pursuit Overview consumes intelligence summary",
      /PursuitIntelligenceSummary/.test(overviewSrc) && /loadPursuitIntelSummary/.test(overviewSrc),
      "wired",
      "opportunities/[id]/page.tsx",
    );

    const contentSrc = read("apps/web/app/(platform)/intelligence/content/search-hits-table.tsx");
    record(
      "content",
      "Content UI surfaces reuse_status",
      /reuse_status/.test(contentSrc) && /formatReuseStatus|REVIEW_REQUIRED/.test(contentSrc),
      "Reuse column present",
      "search-hits-table.tsx",
    );

    // --- Live tenant ---
    const created = await adm.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) throw new Error(created.error?.message ?? "user");
    users.push(created.data.user);
    const asA = await signIn(email, password);
    const orgId = (await asA.rpc("create_organization_with_admin", { org_name: `V5 ${stamp}` })).data;
    orgIds.push(orgId);
    const userId = created.data.user.id;

    // Buyer with multiple pursuits + contracts
    const { data: buyer, error: buyerErr } = await asA
      .from("clients")
      .insert({ organization_id: orgId, name: `Westside ISD ${stamp}` })
      .select("id, name")
      .single();
    if (buyerErr) throw new Error(buyerErr.message);

    const { data: opp1 } = await asA
      .from("opportunities")
      .insert({ organization_id: orgId, client_id: buyer.id, title: `Night coverage ${stamp}` })
      .select("id")
      .single();
    const { data: opp2 } = await asA
      .from("opportunities")
      .insert({ organization_id: orgId, client_id: buyer.id, title: `Day coverage ${stamp}` })
      .select("id")
      .single();

    const { data: c1 } = await asA
      .from("contracts")
      .insert({
        organization_id: orgId,
        client_id: buyer.id,
        opportunity_id: opp1.id,
        title: `Contract night ${stamp}`,
      })
      .select("id")
      .single();
    const { data: c2 } = await asA
      .from("contracts")
      .insert({
        organization_id: orgId,
        client_id: buyer.id,
        opportunity_id: opp2.id,
        title: `Contract day ${stamp}`,
      })
      .select("id")
      .single();

    const awardFact = await addFact(asA, orgId, userId, opp1.id, {
      filename: "award-notice.pdf",
      entity: "award",
      field: "award_notice",
      value: "Awarded to L&P — NTE 250000",
      clientId: buyer.id,
      truth: "awarded",
    });
    const awardPromote = await asA.rpc("promote_verified_fact", { p_fact_id: awardFact.factId });
    record(
      "buyer",
      "Award promotes from verified award fact",
      awardPromote.data?.ok === true && awardPromote.data?.action === "award",
      JSON.stringify(awardPromote.data ?? awardPromote.error),
      "promote_verified_fact",
    );

    const { data: awards } = await asA.from("awards").select("id, opportunity_id").eq("opportunity_id", opp1.id);
    const { data: oppsForBuyer } = await asA.from("opportunities").select("id").eq("client_id", buyer.id);
    const { data: contractsForBuyer } = await asA.from("contracts").select("id").eq("client_id", buyer.id);

    record(
      "buyer",
      "Buyer history connects multiple pursuits",
      (oppsForBuyer?.length ?? 0) >= 2 &&
        oppsForBuyer.some((o) => o.id === opp1.id) &&
        oppsForBuyer.some((o) => o.id === opp2.id),
      `opps=${oppsForBuyer?.length}`,
      buyer.name,
    );
    record(
      "buyer",
      "Buyer history connects multiple contracts",
      (contractsForBuyer?.length ?? 0) >= 2 &&
        contractsForBuyer.some((c) => c.id === c1.id) &&
        contractsForBuyer.some((c) => c.id === c2.id),
      `contracts=${contractsForBuyer?.length}`,
      buyer.name,
    );
    record(
      "buyer",
      "Buyer award links to pursuit under same buyer",
      Array.isArray(awards) && awards.length === 1 && awards[0].opportunity_id === opp1.id,
      JSON.stringify(awards),
      "awards",
    );

    // L&P vs competitor bids
    const lpPriceFact = await addFact(asA, orgId, userId, opp1.id, {
      filename: "lp-price.pdf",
      entity: "win_loss",
      field: "lp_price",
      value: "125000",
      clientId: buyer.id,
    });
    await asA.rpc("promote_intelligence_from_fact", { p_fact_id: lpPriceFact.factId });

    const { data: rival } = await asA
      .from("competitors")
      .insert({ organization_id: orgId, name: `Acme Guard ${stamp}` })
      .select("id")
      .single();

    const bidFact = await addFact(asA, orgId, userId, opp1.id, {
      filename: "bid-tab.pdf",
      entity: "competitor",
      field: "competitor_bid",
      value: "98000",
      clientId: buyer.id,
      documentType: "bid_tab",
    });
    // ensure competitor name on entity for promote path
    await asA
      .from("extracted_facts")
      .update({ entity: `Acme Guard ${stamp}` })
      .eq("id", bidFact.factId);
    const bidPromote = await asA.rpc("promote_intelligence_from_fact", { p_fact_id: bidFact.factId });
    record(
      "competitor",
      "Sourced competitor bid promotes",
      bidPromote.data?.ok === true,
      JSON.stringify(bidPromote.data),
      "competitor_bids",
    );

    const { data: review } = await asA
      .from("win_loss_reviews")
      .select("lp_price, winning_price, outcome")
      .eq("opportunity_id", opp1.id)
      .maybeSingle();
    const { data: bids } = await asA
      .from("competitor_bids")
      .select("id, quoted_amount, source_fact_id, source_document_id, competitor_id, rank")
      .eq("opportunity_id", opp1.id);

    const lpAmount = Number(review?.lp_price);
    const competitorAmount = Number(bids?.[0]?.quoted_amount);
    record(
      "competitor",
      "L&P bids distinguishable from competitor bids",
      Number.isFinite(lpAmount) &&
        Number.isFinite(competitorAmount) &&
        lpAmount === 125000 &&
        competitorAmount === 98000 &&
        lpAmount !== competitorAmount,
      `lp=${lpAmount} competitor=${competitorAmount}`,
      "win_loss_reviews.lp_price vs competitor_bids",
    );

    // Competitor pricing sourced
    const unsourcedLine = await asA.from("competitor_pricing_lines").insert({
      organization_id: orgId,
      opportunity_id: opp1.id,
      competitor_id: rival.id,
      vendor_name: `Acme Guard ${stamp}`,
      labor_category: "unarmed",
      hourly_rate: 18.75,
    });
    const sourcedLine = await asA
      .from("competitor_pricing_lines")
      .insert({
        organization_id: orgId,
        opportunity_id: opp1.id,
        competitor_id: rival.id,
        vendor_name: `Acme Guard ${stamp}`,
        labor_category: "unarmed",
        hourly_rate: 18.75,
        source_fact_id: bidFact.factId,
        source_document_id: bidFact.documentId,
      })
      .select("id, source_fact_id, source_document_id, hourly_rate")
      .single();

    const bidsRequireSource = await asA.from("competitor_bids").insert({
      organization_id: orgId,
      competitor_id: rival.id,
      opportunity_id: opp1.id,
      quoted_amount: 1,
    });
    record(
      "competitor",
      "competitor_bids rejects unsourced insert",
      Boolean(bidsRequireSource.error),
      bidsRequireSource.error?.message ?? "insert succeeded",
      "competitor_bids_has_source",
    );

    const pricingUnsourcedBlocked = Boolean(unsourcedLine.error);
    const pricingSourcedRetained =
      !sourcedLine.error &&
      sourcedLine.data?.source_fact_id === bidFact.factId &&
      sourcedLine.data?.source_document_id === bidFact.documentId &&
      Number(sourcedLine.data?.hourly_rate) === 18.75;
    record(
      "competitor",
      "competitor pricing is sourced",
      pricingUnsourcedBlocked && pricingSourcedRetained,
      pricingUnsourcedBlocked
        ? `unsourced rejected; sourced=${JSON.stringify(sourcedLine.data)}`
        : `GAP: unsourced competitor_pricing_lines insert allowed; sourcedOk=${pricingSourcedRetained} ${sourcedLine.error?.message ?? ""}`,
      "competitor_pricing_lines",
    );

    // Ranks / scores match source
    const { data: scoreLp, error: scoreLpErr } = await asA
      .from("evaluation_scores")
      .insert({
        organization_id: orgId,
        opportunity_id: opp1.id,
        respondent_name: "L&P Global",
        points: 82,
        max_points: 100,
        rank: 2,
        source_fact_id: bidFact.factId,
        source_document_id: bidFact.documentId,
        notes: "Technical 40 + Price 42",
      })
      .select("id, points, max_points, rank, respondent_name")
      .single();
    const { data: scoreWin } = await asA
      .from("evaluation_scores")
      .insert({
        organization_id: orgId,
        opportunity_id: opp1.id,
        respondent_name: `Acme Guard ${stamp}`,
        points: 91,
        max_points: 100,
        rank: 1,
        source_fact_id: bidFact.factId,
        source_document_id: bidFact.documentId,
      })
      .select("id, points, rank")
      .single();

    await asA
      .from("competitor_bids")
      .update({ rank: 1 })
      .eq("opportunity_id", opp1.id)
      .eq("competitor_id", rival.id);

    const { data: scoreRows } = await asA
      .from("evaluation_scores")
      .select("respondent_name, points, max_points, rank")
      .eq("opportunity_id", opp1.id)
      .order("rank", { ascending: true });
    const { data: bidRank } = await asA
      .from("competitor_bids")
      .select("rank, quoted_amount")
      .eq("opportunity_id", opp1.id)
      .single();

    record(
      "scores",
      "ranks/scores match source records",
      !scoreLpErr &&
        scoreLp?.points === 82 &&
        scoreLp?.rank === 2 &&
        scoreWin?.points === 91 &&
        scoreWin?.rank === 1 &&
        bidRank?.rank === 1 &&
        Array.isArray(scoreRows) &&
        scoreRows[0].rank === 1 &&
        scoreRows[0].points === 91,
      JSON.stringify({ scoreRows, bidRank }),
      "evaluation_scores + competitor_bids.rank",
    );

    // Documented reason separate from internal analysis
    const same = await asA.from("win_loss_reviews").insert({
      organization_id: orgId,
      opportunity_id: opp2.id,
      outcome: "LOST",
      documented_reason: "identical",
      internal_analysis: "identical",
    });
    record(
      "winloss",
      "documented loss reason remains separate from internal analysis (constraint)",
      Boolean(same.error),
      same.error?.message ?? "insert succeeded",
      "win_loss_reason_not_analysis",
    );

    const reasonFact = await addFact(asA, orgId, userId, opp1.id, {
      filename: "debrief.pdf",
      field: "documented_reason",
      value: "Evaluator cited staffing depth",
      clientId: buyer.id,
    });
    const analysisFact = await addFact(asA, orgId, userId, opp1.id, {
      filename: "internal-note.pdf",
      field: "internal_analysis",
      value: "We understaffed the transition plan",
      clientId: buyer.id,
    });
    await asA.rpc("promote_intelligence_from_fact", { p_fact_id: reasonFact.factId });
    await asA.rpc("promote_intelligence_from_fact", { p_fact_id: analysisFact.factId });
    const { data: wl } = await asA
      .from("win_loss_reviews")
      .select("documented_reason, internal_analysis, lessons_learned, outcome, lp_price")
      .eq("opportunity_id", opp1.id)
      .single();
    record(
      "winloss",
      "documented reason stays distinct from internal analysis after promote",
      wl?.documented_reason === "Evaluator cited staffing depth" &&
        wl?.internal_analysis === "We understaffed the transition plan" &&
        wl.documented_reason !== wl.internal_analysis,
      JSON.stringify(wl),
      "win_loss_reviews",
    );

    // Raw mention must not become competitor bid
    const rawMention = await addFact(asA, orgId, userId, opp1.id, {
      filename: "narrative.pdf",
      entity: "document",
      field: "body_text",
      value: "Acme Guard was mentioned in the board packet as a prior vendor.",
      clientId: buyer.id,
    });
    const rawPromote = await asA.rpc("promote_intelligence_from_fact", { p_fact_id: rawMention.factId });
    const { count: bidCountAfterMention } = await asA
      .from("competitor_bids")
      .select("id", { count: "exact", head: true })
      .eq("opportunity_id", opp1.id);
    const aiBid = await addFact(asA, orgId, userId, opp1.id, {
      filename: "ai-guess.pdf",
      entity: "competitor",
      field: "competitor_bid",
      value: "50000",
      status: "AI_EXTRACTED",
      clientId: buyer.id,
    });
    const aiPromote = await asA.rpc("promote_intelligence_from_fact", { p_fact_id: aiBid.factId });
    const { count: bidCountAfterAi } = await asA
      .from("competitor_bids")
      .select("id", { count: "exact", head: true })
      .eq("opportunity_id", opp1.id);

    record(
      "honesty",
      "raw document mention does not become a competitor bid",
      (rawPromote.data?.action === "skipped" || rawPromote.data?.message?.includes?.("Not an intelligence")) &&
        bidCountAfterMention === (bids?.length ?? 1) &&
        aiPromote.data?.ok === false &&
        bidCountAfterAi === bidCountAfterMention,
      JSON.stringify({ rawPromote: rawPromote.data, aiPromote: aiPromote.data, bidCountAfterMention, bidCountAfterAi }),
      "promote_intelligence_from_fact",
    );

    // Raw mention must not become award
    const { count: awardBefore } = await asA
      .from("awards")
      .select("id", { count: "exact", head: true })
      .eq("opportunity_id", opp1.id);
    const rawAwardMention = await addFact(asA, orgId, userId, opp1.id, {
      filename: "minutes.pdf",
      entity: "document",
      field: "body_text",
      value: "Board discussed a possible award to L&P next quarter.",
      clientId: buyer.id,
      truth: "proposed",
    });
    const rawAwardPromote = await asA.rpc("promote_verified_fact", {
      p_fact_id: rawAwardMention.factId,
    });
    if (rawAwardPromote.error) {
      console.log("rawAwardPromote error", rawAwardPromote.error);
    }
    const proposedAward = await addFact(asA, orgId, userId, opp1.id, {
      filename: "proposal-claim.pdf",
      entity: "award",
      field: "award_notice",
      value: "We expect award",
      clientId: buyer.id,
      truth: "proposed",
      documentType: "proposal",
    });
    const proposedAwardPromote = await asA.rpc("promote_verified_fact", {
      p_fact_id: proposedAward.factId,
    });
    if (proposedAwardPromote.error) {
      console.log("proposedAwardPromote error", proposedAwardPromote.error);
    }
    const { count: awardAfter } = await asA
      .from("awards")
      .select("id", { count: "exact", head: true })
      .eq("opportunity_id", opp1.id);

    const rawSkipped =
      rawAwardPromote.data?.action === "skipped" ||
      rawAwardPromote.data?.ok === false ||
      (rawAwardPromote.data?.ok === true && rawAwardPromote.data?.action !== "award");
    record(
      "honesty",
      "raw mention does not become an award",
      awardAfter === awardBefore &&
        !rawAwardPromote.error &&
        rawSkipped &&
        !proposedAwardPromote.error &&
        proposedAwardPromote.data?.ok === false,
      JSON.stringify({
        awardBefore,
        awardAfter,
        rawAwardPromote: rawAwardPromote.data,
        rawAwardError: rawAwardPromote.error,
        proposedAwardPromote: proposedAwardPromote.data,
        proposedAwardError: proposedAwardPromote.error,
      }),
      "promote_verified_fact",
    );

    // Market metrics based on business records (live counts vs documents)
    const [docCount, awardCount, reviewCount, bidCount, pricingCount] = await Promise.all([
      asA.from("documents").select("*", { count: "exact", head: true }),
      asA.from("awards").select("*", { count: "exact", head: true }),
      asA.from("win_loss_reviews").select("*", { count: "exact", head: true }),
      asA.from("competitor_bids").select("*", { count: "exact", head: true }),
      asA.from("pricing_lines").select("*", { count: "exact", head: true }),
    ]);
    record(
      "market",
      "Market metrics are based on business records",
      (docCount.count ?? 0) > 0 &&
        (awardCount.count ?? 0) >= 1 &&
        (reviewCount.count ?? 0) >= 1 &&
        (bidCount.count ?? 0) >= 1 &&
        !/from\("documents"\)/.test(marketSrc),
      JSON.stringify({
        documents: docCount.count,
        awards: awardCount.count,
        reviews: reviewCount.count,
        bids: bidCount.count,
        pricing_lines: pricingCount.count,
      }),
      "business tables ≠ documents",
    );

    // Content reuse enforced + WON/LOST independence
    const chunkFact = await addFact(asA, orgId, userId, opp1.id, {
      filename: "proposal-section.pdf",
      entity: "proposal",
      field: "staffing_approach",
      value: "Staffing depth at all posts with named relief pool",
      clientId: buyer.id,
      truth: "proposed",
      documentType: "proposal",
      sourcePage: 3,
      sourceExcerpt: "Staffing depth at all posts",
    });
    const chunkPromote = await asA.rpc("promote_knowledge_chunk_from_fact", {
      p_fact_id: chunkFact.factId,
    });
    record(
      "content",
      "verified fact becomes knowledge chunk",
      chunkPromote.data?.ok === true,
      JSON.stringify(chunkPromote.data),
      "promote_knowledge_chunk_from_fact",
    );

    const { data: chunk } = await asA
      .from("document_chunks")
      .select("id, reuse_status, content, source_fact_id")
      .eq("source_fact_id", chunkFact.factId)
      .single();

    await asA.from("document_chunks").update({ reuse_status: "REVIEW_REQUIRED" }).eq("id", chunk.id);

    const outcomeWon = await addFact(asA, orgId, userId, opp1.id, {
      filename: "outcome-won.pdf",
      entity: "win_loss",
      field: "outcome",
      value: "won — awarded",
      clientId: buyer.id,
    });
    await asA.rpc("promote_intelligence_from_fact", { p_fact_id: outcomeWon.factId });
    const { data: chunkAfterWon } = await asA
      .from("document_chunks")
      .select("reuse_status")
      .eq("id", chunk.id)
      .single();
    const { data: wlWon } = await asA
      .from("win_loss_reviews")
      .select("outcome")
      .eq("opportunity_id", opp1.id)
      .single();

    record(
      "content",
      "WON does not automatically equal APPROVED",
      wlWon?.outcome === "WON" && chunkAfterWon?.reuse_status === "REVIEW_REQUIRED",
      JSON.stringify({ outcome: wlWon?.outcome, reuse: chunkAfterWon?.reuse_status }),
      "win_loss vs document_chunks.reuse_status",
    );

    await asA.from("document_chunks").update({ reuse_status: "APPROVED" }).eq("id", chunk.id);
    // Use opp2 for LOST so we don't fight opp1 WON uniqueness semantics beyond upsert
    const chunkFact2 = await addFact(asA, orgId, userId, opp2.id, {
      filename: "proposal-section-2.pdf",
      entity: "proposal",
      field: "transition_plan",
      value: "Transition staffing plan with named leads",
      clientId: buyer.id,
      truth: "proposed",
      documentType: "proposal",
    });
    await asA.rpc("promote_knowledge_chunk_from_fact", { p_fact_id: chunkFact2.factId });
    const { data: chunk2 } = await asA
      .from("document_chunks")
      .select("id, reuse_status")
      .eq("source_fact_id", chunkFact2.factId)
      .single();

    const outcomeLost = await addFact(asA, orgId, userId, opp2.id, {
      filename: "outcome-lost.pdf",
      entity: "win_loss",
      field: "outcome",
      value: "unsuccessful — lost on price",
      clientId: buyer.id,
    });
    await asA.rpc("promote_intelligence_from_fact", { p_fact_id: outcomeLost.factId });
    const { data: chunkAfterLost } = await asA
      .from("document_chunks")
      .select("reuse_status")
      .eq("id", chunk2.id)
      .single();
    const { data: wlLost } = await asA
      .from("win_loss_reviews")
      .select("outcome")
      .eq("opportunity_id", opp2.id)
      .single();

    record(
      "content",
      "LOST does not automatically equal DO_NOT_USE",
      wlLost?.outcome === "LOST" && chunkAfterLost?.reuse_status === "APPROVED",
      JSON.stringify({ outcome: wlLost?.outcome, reuse: chunkAfterLost?.reuse_status }),
      "win_loss vs document_chunks.reuse_status",
    );

    await asA.from("document_chunks").update({ reuse_status: "DO_NOT_USE" }).eq("id", chunk.id);
    const { data: draftingHits } = await asA.rpc("search_verified_knowledge", {
      p_query: "Staffing depth at all posts",
      p_for_drafting: true,
      p_limit: 10,
    });
    const { data: allHits } = await asA.rpc("search_verified_knowledge", {
      p_query: "Staffing depth at all posts",
      p_for_drafting: false,
      p_limit: 10,
    });
    const draftingHas = (draftingHits ?? []).some((h) => h.chunk_id === chunk.id);
    const allHas = (allHits ?? []).some((h) => h.chunk_id === chunk.id);
    record(
      "content",
      "Content reuse state is enforced",
      draftingHas === false && allHas === true,
      JSON.stringify({
        draftingCount: draftingHits?.length ?? 0,
        allCount: allHits?.length ?? 0,
        draftingHas,
        allHas,
      }),
      "search_verified_knowledge",
    );

    // Public facts retain provenance
    const researchFact = await addFact(asA, orgId, userId, opp1.id, {
      filename: "research.pdf",
      entity: "research",
      field: "research_url",
      value: "https://example.com/board-minutes-westside",
      clientId: buyer.id,
      sourcePage: 12,
      sourceExcerpt: "Board approved night coverage solicitation",
    });
    const researchPromote = await asA.rpc("promote_intelligence_from_fact", {
      p_fact_id: researchFact.factId,
    });
    const { data: research } = await asA
      .from("research_facts")
      .select(
        "source_url, client_id, opportunity_id, source_document_id, excerpt, verification_status, verified_by, verified_at, published_on, retrieved_at",
      )
      .eq("client_id", buyer.id)
      .order("retrieved_at", { ascending: false })
      .limit(1)
      .single();

    record(
      "research",
      "public facts retain provenance",
      researchPromote.data?.ok === true &&
        research?.source_url === "https://example.com/board-minutes-westside" &&
        research?.client_id === buyer.id &&
        research?.source_document_id === researchFact.documentId &&
        research?.verification_status === "HUMAN_VERIFIED" &&
        research?.verified_by === userId &&
        Boolean(research?.verified_at) &&
        Boolean(research?.retrieved_at),
      JSON.stringify(research),
      "research_facts",
    );

    // Current pursuit can consume relevant intelligence
    const { data: pursuitWl } = await asA
      .from("win_loss_reviews")
      .select("outcome, documented_reason, internal_analysis, lp_price, winning_price, winner_name")
      .eq("opportunity_id", opp1.id)
      .single();
    const { data: pursuitBids } = await asA
      .from("competitor_bids")
      .select("quoted_amount, rank, source_url, source_fact_id, competitors(name)")
      .eq("opportunity_id", opp1.id);
    const { data: pursuitScores } = await asA
      .from("evaluation_scores")
      .select("respondent_name, points, max_points, rank")
      .eq("opportunity_id", opp1.id);
    const { count: researchCount } = await asA
      .from("research_facts")
      .select("id", { count: "exact", head: true })
      .eq("client_id", buyer.id);
    const { data: pursuitAward } = await asA
      .from("awards")
      .select("id, notice")
      .eq("opportunity_id", opp1.id)
      .maybeSingle();

    record(
      "pursuit",
      "current Pursuit can consume relevant intelligence",
      pursuitWl?.outcome === "WON" &&
        pursuitWl?.documented_reason &&
        pursuitWl?.internal_analysis &&
        pursuitWl?.lp_price != null &&
        (pursuitBids?.length ?? 0) >= 1 &&
        (pursuitScores?.length ?? 0) >= 2 &&
        (researchCount ?? 0) >= 1 &&
        Boolean(pursuitAward?.id) &&
        existsSync(join(ROOT, "apps/web/lib/intelligence/load-corpus.ts")) &&
        /loadPursuitIntelSummary/.test(read("apps/web/lib/intelligence/load-corpus.ts")),
      JSON.stringify({
        outcome: pursuitWl?.outcome,
        bids: pursuitBids?.length,
        scores: pursuitScores?.length,
        researchCount,
        award: pursuitAward?.id,
      }),
      `opportunity ${opp1.id}`,
    );
  } catch (e) {
    record("fatal", "suite error", false, e instanceof Error ? e.message : String(e));
  } finally {
    const a = admin();
    for (const orgId of orgIds) {
      await a.from("organizations").delete().eq("id", orgId);
    }
    for (const u of users) {
      await a.auth.admin.deleteUser(u.id);
    }
  }

  const verdict = writeReport();
  process.exit(verdict === "PASS" ? 0 : 1);
}

main();
