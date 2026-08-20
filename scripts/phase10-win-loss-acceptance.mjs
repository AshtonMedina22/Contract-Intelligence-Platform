import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;

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

  const verified = opts.status !== "AI_EXTRACTED";
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
      verified_value: verified ? opts.value : null,
      verification_status: opts.status ?? "HUMAN_VERIFIED",
      verified_by: verified ? userId : null,
      verified_at: verified ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (factError) throw new Error(factError.message);
  return fact.id;
}

async function main() {
  const admin = adminClient();
  const password = "Phase10-Intel!22";
  const emailA = `phase10-a-${stamp}@example.com`;
  const emailB = `phase10-b-${stamp}@example.com`;

  try {
    const createdA = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true });
    const createdB = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true });
    if (createdA.error || !createdA.data.user) throw new Error(createdA.error?.message ?? "user A");
    if (createdB.error || !createdB.data.user) throw new Error(createdB.error?.message ?? "user B");
    users.push(createdA.data.user, createdB.data.user);

    const asA = await signIn(emailA, password);
    const asB = await signIn(emailB, password);
    const orgA = (await asA.rpc("create_organization_with_admin", { org_name: `P10 A ${stamp}` })).data;
    const orgB = (await asB.rpc("create_organization_with_admin", { org_name: `P10 B ${stamp}` })).data;
    orgIds.push(orgA, orgB);

    const { data: clientRow, error: clientError } = await asA
      .from("clients")
      .insert({ organization_id: orgA, name: "Westside ISD" })
      .select("id")
      .single();
    if (clientError) throw new Error(clientError.message);

    const { data: opportunity, error: oppError } = await asA
      .from("opportunities")
      .insert({ organization_id: orgA, client_id: clientRow.id, title: "Night coverage award" })
      .select("id")
      .single();
    if (oppError) throw new Error(oppError.message);

    const sameText = "price was too high";
    const dupReason = await asA.from("win_loss_reviews").insert({
      organization_id: orgA,
      opportunity_id: opportunity.id,
      outcome: "LOST",
      documented_reason: sameText,
      internal_analysis: sameText,
    });
    record(
      "constraint",
      "documented_reason cannot equal internal_analysis",
      Boolean(dupReason.error),
      dupReason.error?.message ?? "insert succeeded",
    );

    const { data: competitor, error: competitorError } = await asA
      .from("competitors")
      .insert({ organization_id: orgA, name: "Acme Guard" })
      .select("id")
      .single();
    if (competitorError) throw new Error(competitorError.message);

    const unsourced = await asA.from("competitor_bids").insert({
      organization_id: orgA,
      competitor_id: competitor.id,
      opportunity_id: opportunity.id,
      quoted_amount: 125000,
    });
    record(
      "constraint",
      "competitor bid without source is rejected",
      Boolean(unsourced.error),
      unsourced.error?.message ?? "insert succeeded",
    );

    const unverifiedResearch = await asA.from("research_facts").insert({
      organization_id: orgA,
      client_id: clientRow.id,
      source_url: "https://example.com/board-minutes",
      title: "Board minutes",
      verification_status: "HUMAN_VERIFIED",
    });
    record(
      "constraint",
      "HUMAN_VERIFIED research requires actor and timestamp",
      Boolean(unverifiedResearch.error),
      unverifiedResearch.error?.message ?? "insert succeeded",
    );

    const unverifiedFact = await addFact(asA, orgA, createdA.data.user.id, opportunity.id, {
      filename: "ai-only.pdf",
      entity: "win_loss",
      field: "outcome",
      value: "lost",
      status: "AI_EXTRACTED",
      clientId: clientRow.id,
    });
    const skipped = await asA.rpc("promote_intelligence_from_fact", { p_fact_id: unverifiedFact });
    record(
      "promote",
      "AI_EXTRACTED does not promote",
      skipped.data?.ok === false && skipped.data?.action === "skipped",
      JSON.stringify(skipped.data),
    );

    const outcomeFact = await addFact(asA, orgA, createdA.data.user.id, opportunity.id, {
      filename: "debrief.pdf",
      entity: "win_loss",
      field: "outcome",
      value: "unsuccessful — lost on price",
      clientId: clientRow.id,
    });
    const promoted = await asA.rpc("promote_intelligence_from_fact", { p_fact_id: outcomeFact });
    record("promote", "HUMAN_VERIFIED outcome promotes", promoted.data?.ok === true, JSON.stringify(promoted.data));

    const reasonFact = await addFact(asA, orgA, createdA.data.user.id, opportunity.id, {
      filename: "debrief-reason.pdf",
      field: "documented_reason",
      value: "Evaluator cited staffing depth",
      clientId: clientRow.id,
    });
    const reasonPromoted = await asA.rpc("promote_intelligence_from_fact", { p_fact_id: reasonFact });
    record(
      "promote",
      "documented_reason promotes",
      reasonPromoted.data?.ok === true,
      JSON.stringify(reasonPromoted.data),
    );

    const analysisFact = await addFact(asA, orgA, createdA.data.user.id, opportunity.id, {
      filename: "internal-note.pdf",
      field: "internal_analysis",
      value: "We understaffed the transition plan",
      clientId: clientRow.id,
    });
    const analysisPromoted = await asA.rpc("promote_intelligence_from_fact", { p_fact_id: analysisFact });
    record(
      "promote",
      "internal_analysis promotes separately",
      analysisPromoted.data?.ok === true,
      JSON.stringify(analysisPromoted.data),
    );

    const { data: review } = await asA
      .from("win_loss_reviews")
      .select("outcome, documented_reason, internal_analysis")
      .eq("opportunity_id", opportunity.id)
      .single();
    record(
      "review",
      "reason and analysis stay distinct",
      review?.outcome === "LOST" &&
        review?.documented_reason === "Evaluator cited staffing depth" &&
        review?.internal_analysis === "We understaffed the transition plan" &&
        review?.documented_reason !== review?.internal_analysis,
      JSON.stringify(review),
    );

    const bidFact = await addFact(asA, orgA, createdA.data.user.id, opportunity.id, {
      filename: "competitor-tab.pdf",
      entity: "competitor",
      field: "competitor_bid",
      value: "98000",
      clientId: clientRow.id,
    });
    const bidPromoted = await asA.rpc("promote_intelligence_from_fact", { p_fact_id: bidFact });
    record("promote", "competitor bid with fact source", bidPromoted.data?.ok === true, JSON.stringify(bidPromoted.data));

    const { data: bids } = await asA.from("competitor_bids").select("quoted_amount, source_fact_id").eq("opportunity_id", opportunity.id);
    record(
      "bids",
      "sourced bid stored",
      Array.isArray(bids) && bids.length > 0 && bids[0].source_fact_id === bidFact,
      JSON.stringify(bids),
    );

    const urlFact = await addFact(asA, orgA, createdA.data.user.id, opportunity.id, {
      filename: "research.pdf",
      entity: "research",
      field: "research_url",
      value: "https://example.com/procurement-notice",
      clientId: clientRow.id,
    });
    const urlPromoted = await asA.rpc("promote_intelligence_from_fact", { p_fact_id: urlFact });
    record("promote", "research URL promotes", urlPromoted.data?.ok === true, JSON.stringify(urlPromoted.data));

    const { data: research } = await asA
      .from("research_facts")
      .select("source_url, verification_status, verified_by")
      .eq("client_id", clientRow.id);
    record(
      "research",
      "verified research has URL and actor",
      research?.[0]?.source_url === "https://example.com/procurement-notice" &&
        research?.[0]?.verification_status === "HUMAN_VERIFIED" &&
        research?.[0]?.verified_by === createdA.data.user.id,
      JSON.stringify(research),
    );

    const { data: bReviews } = await asB.from("win_loss_reviews").select("id").eq("opportunity_id", opportunity.id);
    record("rls", "org B cannot read org A win/loss", !bReviews || bReviews.length === 0);
  } catch (error) {
    record("fatal", error instanceof Error ? error.message : String(error), false);
  } finally {
    const adminInner = adminClient();
    for (const orgId of orgIds) {
      await adminInner.from("organizations").delete().eq("id", orgId);
    }
    for (const user of users) {
      if (user?.id) await adminInner.auth.admin.deleteUser(user.id);
    }
    const failed = results.filter((row) => !row.ok).length;
    console.log(`${results.filter((r) => r.ok).length} passed, ${failed} failed, ${results.length} total`);
    process.exit(failed ? 1 : 0);
  }
}

await main();
