#!/usr/bin/env node
/**
 * Canonical Phase 5 — Cross-corpus Intelligence acceptance.
 * Schema honesty + promote constraints + UI surface checks.
 * Legacy phase10-win-loss remains valid for promote RPCs.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const root = join(process.cwd());

if (!url || !publishable || !secret) {
  console.error("Missing Supabase env.");
  process.exit(1);
}

const stamp = Date.now().toString(36);
const results = [];
const orgIds = [];
const users = [];

function record(area, name, ok, detail = "") {
  results.push({ area, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${area}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function adminClient() {
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

function anonClient() {
  return createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(email, password) {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(error?.message ?? "sign-in failed");
  return client;
}

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
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

  const { data: run, error: runError } = await client
    .from("extraction_runs")
    .insert({ organization_id: orgId, document_version_id: version.id })
    .select("id")
    .single();
  if (runError) throw new Error(runError.message);

  const { data: fact, error: factError } = await client
    .from("extracted_facts")
    .insert({
      organization_id: orgId,
      extraction_run_id: run.id,
      document_id: document.id,
      document_version_id: version.id,
      entity: opts.entity ?? "document",
      field: opts.field,
      raw_value: opts.value,
      normalized_value: opts.value,
      verified_value: opts.value,
      verification_status: "HUMAN_VERIFIED",
      verified_by: userId,
      verified_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (factError) throw new Error(factError.message);
  return fact.id;
}

async function main() {
  const admin = adminClient();
  const password = "Phase5-Intel!22";
  const emailA = `phase5-a-${stamp}@example.com`;

  try {
    // --- Static surfaces ---
    const surfaces = [
      "apps/web/app/(platform)/intelligence/clients/page.tsx",
      "apps/web/app/(platform)/intelligence/competitors/page.tsx",
      "apps/web/app/(platform)/intelligence/market/page.tsx",
      "apps/web/app/(platform)/intelligence/pricing/page.tsx",
      "apps/web/app/(platform)/intelligence/win-loss/page.tsx",
      "apps/web/app/(platform)/intelligence/content/page.tsx",
      "apps/web/app/(platform)/intelligence/reports/page.tsx",
      "apps/web/components/opportunity-workspace/pursuit-intelligence-summary.tsx",
      "apps/web/lib/intelligence/load-corpus.ts",
      "supabase/migrations/20260820700000_phase5_intelligence_honesty.sql",
    ];
    for (const rel of surfaces) {
      record("ui", `exists ${rel}`, existsSync(join(root, rel)));
    }

    const marketSrc = read("apps/web/app/(platform)/intelligence/market/page.tsx");
    record(
      "honesty",
      "Market page does not use documents count as market fact",
      !/from\("documents"\)/.test(marketSrc) && /Verified awards|verified observations/i.test(marketSrc),
    );

    const buyersSrc = read("apps/web/app/(platform)/intelligence/clients/page.tsx");
    record(
      "honesty",
      "Buyers page is procurement intelligence not CRM",
      /Not CRM|procurement intelligence/i.test(buyersSrc) && /loadBuyerPortfolio/.test(buyersSrc),
    );

    const contentSrc = read("apps/web/app/(platform)/intelligence/content/search-hits-table.tsx");
    record(
      "honesty",
      "Content search shows reuse_status",
      /reuse_status/.test(contentSrc) && /REVIEW_REQUIRED|formatReuseStatus/.test(contentSrc),
    );

    // P5 moved the pursuit intelligence summary from a standalone panel into the Overview bundle,
    // so the check follows the composition: page renders the sections, bundle loads the intel.
    const overviewSrc = read(
      "apps/web/app/(platform)/procurement/opportunities/[opportunityId]/page.tsx",
    );
    const overviewBundleSrc = read("apps/web/lib/opportunity/load-overview-bundle.ts");
    const overviewSectionsSrc = read(
      "apps/web/components/opportunity-workspace/overview-sections.tsx",
    );
    record(
      "ui",
      "Pursuit Overview surfaces intelligence summary",
      /OverviewSections/.test(overviewSrc) &&
        /loadOverviewBundle/.test(overviewSrc) &&
        /loadPursuitIntelSummary/.test(overviewBundleSrc) &&
        /Competitive intelligence/.test(overviewSectionsSrc) &&
        /Buyer intelligence/.test(overviewSectionsSrc),
    );

    const typesSrc = read("apps/web/lib/supabase/database.types.ts");
    record(
      "schema",
      "ReuseStatus includes REVIEW_REQUIRED",
      /ReuseStatus = "APPROVED" \| "REVIEW_REQUIRED" \| "DO_NOT_USE" \| "SUPERSEDED"/.test(typesSrc),
    );
    record("schema", "win_loss_reviews.lessons_learned typed", /lessons_learned/.test(typesSrc));

    // --- Live DB ---
    const { data: createdA, error: userError } = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    if (userError || !createdA.user) throw new Error(userError?.message ?? "user A");
    users.push(createdA.user);

    const asA = await signIn(emailA, password);
    const orgA = (await asA.rpc("create_organization_with_admin", { org_name: `P5 A ${stamp}` })).data;
    orgIds.push(orgA);

    // Enum: try insert chunk with REVIEW_REQUIRED
    const { data: clientRow, error: clientError } = await asA
      .from("clients")
      .insert({ organization_id: orgA, name: `Agency ${stamp}` })
      .select("id")
      .single();
    if (clientError) throw new Error(clientError.message);

    const { data: opportunityConstraint, error: oppCError } = await asA
      .from("opportunities")
      .insert({ organization_id: orgA, client_id: clientRow.id, title: `P5 constraint ${stamp}` })
      .select("id")
      .single();
    if (oppCError) throw new Error(oppCError.message);

    const sameText = await asA.from("win_loss_reviews").insert({
      organization_id: orgA,
      opportunity_id: opportunityConstraint.id,
      outcome: "LOST",
      documented_reason: "identical text",
      internal_analysis: "identical text",
    });
    record(
      "constraint",
      "documented_reason cannot equal internal_analysis",
      Boolean(sameText.error),
      sameText.error?.message ?? "insert succeeded",
    );

    const { data: opportunity, error: oppError } = await asA
      .from("opportunities")
      .insert({ organization_id: orgA, client_id: clientRow.id, title: `P5 pursuit ${stamp}` })
      .select("id")
      .single();
    if (oppError) throw new Error(oppError.message);

    const { error: lessonsOk } = await asA.from("win_loss_reviews").insert({
      organization_id: orgA,
      opportunity_id: opportunity.id,
      outcome: "LOST",
      documented_reason: "Evaluator cited price",
      internal_analysis: "We missed staffing depth",
      lessons_learned: "Staff transition earlier next time",
      lp_price: 120000,
      winning_price: 98000,
      winner_name: "Acme Guard",
    });
    record("schema", "win_loss_reviews accepts lessons_learned", !lessonsOk, lessonsOk?.message ?? "");

    const { data: review } = await asA
      .from("win_loss_reviews")
      .select("lessons_learned, documented_reason, internal_analysis")
      .eq("opportunity_id", opportunity.id)
      .single();
    record(
      "honesty",
      "reason / analysis / lessons stay distinct",
      review?.documented_reason !== review?.internal_analysis &&
        review?.lessons_learned === "Staff transition earlier next time",
      JSON.stringify(review),
    );

    const { data: competitor, error: competitorError } = await asA
      .from("competitors")
      .insert({ organization_id: orgA, name: "Rival Co" })
      .select("id")
      .single();
    if (competitorError) throw new Error(competitorError.message);

    const unsourced = await asA.from("competitor_bids").insert({
      organization_id: orgA,
      competitor_id: competitor.id,
      opportunity_id: opportunity.id,
      quoted_amount: 99000,
      rank: 1,
    });
    record(
      "constraint",
      "competitor bid without source rejected",
      Boolean(unsourced.error),
      unsourced.error?.message ?? "insert succeeded",
    );

    const bidFact = await addFact(asA, orgA, createdA.user.id, opportunity.id, {
      filename: "bid-tab.pdf",
      entity: "competitor",
      field: "competitor_bid",
      value: "99000",
      clientId: clientRow.id,
    });
    const bidPromoted = await asA.rpc("promote_intelligence_from_fact", { p_fact_id: bidFact });
    record(
      "promote",
      "sourced competitor bid promotes",
      bidPromoted.data?.ok === true,
      JSON.stringify(bidPromoted.data),
    );

    // Probe REVIEW_REQUIRED via document_chunks if table accessible
    const sha = createHash("sha256").update(`chunk-${stamp}`).digest("hex");
    const { data: document } = await asA
      .from("documents")
      .insert({
        organization_id: orgA,
        opportunity_id: opportunity.id,
        original_filename: "proposal.pdf",
        document_type: "proposal",
        commercial_truth: "proposed",
        mime_type: "application/pdf",
      })
      .select("id")
      .single();
    const { data: version } = await asA
      .from("document_versions")
      .insert({
        organization_id: orgA,
        document_id: document.id,
        sha256: sha,
        storage_path: `${orgA}/${document.id}/v/${sha}/original.pdf`,
      })
      .select("id")
      .single();

    const { error: reviewRequiredErr } = await asA.from("document_chunks").insert({
      organization_id: orgA,
      document_id: document.id,
      document_version_id: version.id,
      content: "Staffing approach paragraph",
      chunk_index: 0,
      storage_path: `${orgA}/${document.id}/v/${sha}/original.pdf`,
      verification_status: "HUMAN_VERIFIED",
      reuse_status: "REVIEW_REQUIRED",
      is_current_version: true,
    });
    const { error: legacyReviewErr } = await asA.from("document_chunks").insert({
      organization_id: orgA,
      document_id: document.id,
      document_version_id: version.id,
      content: "Should not accept REVIEW",
      chunk_index: 1,
      storage_path: `${orgA}/${document.id}/v/${sha}/original.pdf`,
      verification_status: "HUMAN_VERIFIED",
      reuse_status: "REVIEW",
      is_current_version: true,
    });
    record(
      "schema",
      "reuse_status accepts REVIEW_REQUIRED",
      !reviewRequiredErr,
      reviewRequiredErr?.message ?? "",
    );
    record(
      "schema",
      "reuse_status rejects legacy REVIEW",
      Boolean(legacyReviewErr),
      legacyReviewErr?.message ?? "REVIEW still accepted",
    );

    const { data: score, error: scoreError } = await asA.from("evaluation_scores").insert({
      organization_id: orgA,
      opportunity_id: opportunity.id,
      respondent_name: "L&P Global",
      points: 82,
      max_points: 100,
      rank: 2,
      source_fact_id: bidFact,
    }).select("id").single();
    record("schema", "evaluation_scores insertable with rank", !scoreError && Boolean(score?.id), scoreError?.message ?? "");

    const nav = read("apps/web/components/section-tabs.tsx");
    record(
      "ui",
      "INTELLIGENCE_TABS covers Buyers Competitors Market Pricing Win/Loss Content Reports",
      /Buyers/.test(nav) &&
        /Competitors/.test(nav) &&
        /Market/.test(nav) &&
        /Pricing/.test(nav) &&
        /Win\/Loss|Win-Loss|win-loss/i.test(nav) &&
        /Content/.test(nav) &&
        /Reports/.test(nav),
    );
  } catch (e) {
    record("fatal", "suite error", false, e instanceof Error ? e.message : String(e));
  } finally {
    const admin = adminClient();
    for (const orgId of orgIds) {
      await admin.from("organizations").delete().eq("id", orgId);
    }
    for (const u of users) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) {
    console.error("Failures:");
    for (const f of failed) console.error(`  [${f.area}] ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main();
