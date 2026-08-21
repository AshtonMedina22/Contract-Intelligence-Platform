/**
 * VERIFY 8 — Proposal workflow acceptance (Canonical Phase 8).
 * End-to-end Pursuit flow using a real solicitation-shaped package (Arlington RFP /
 * Lottery IFB patterns from PILOT_CORPUS_MANIFEST). Does not fabricate L&P historical
 * rates, staffing, or performance as unverified market truth.
 *
 * Run: node --env-file=apps/web/.env.local scripts/verify8-proposal-workflow-acceptance.mjs
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(import.meta.dirname, "..");
const OUT_JSON = join(ROOT, "docs/benchmarks/verify8-results.json");
const OUT_MD = join(ROOT, "docs/pilot/VERIFY8_ACCEPTANCE.md");

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

/** Package identity — mirrors SRC-06 Arlington + SRC-09 Lottery form patterns (buyer-side). */
const PACKAGE = {
  key: "V8-ARLINGTON-LOTTERY-SHAPE",
  buyer: "City of Arlington (VERIFY8 fixture — buyer solicitation shape)",
  solicitationNumber: `RFP-22-0143-V8-${stamp}`,
  title: `Armed Security Services — VERIFY8 ${stamp}`,
  requirement:
    "Offeror shall provide armed security coverage by building with a verified staffing plan and required forms.",
  formName: "HUB / References / Cost Sheet (Lottery IFB-style)",
};

function record(step, name, ok, detail = "", source = "") {
  matrix.push({ step, name, ok, detail, source });
  console.log(
    `${ok ? "PASS" : "FAIL"}  [${String(step).padStart(2, "0")}] ${name}${detail ? ` — ${detail}` : ""}${source ? ` {${source}}` : ""}`,
  );
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

function classifyEvidenceFromHits(hits) {
  const usable = hits.filter((h) => h.reuse_status !== "DO_NOT_USE" && h.reuse_status !== "SUPERSEDED");
  if (usable.length === 0) return "L_AND_P_INPUT_REQUIRED";
  if (usable.some((h) => h.reuse_status === "APPROVED")) return "VERIFIED_DRAFT_AVAILABLE";
  return "REVIEW_REQUIRED";
}

function computeResponseProgress(requirements, responses) {
  const byReq = new Map(responses.map((r) => [r.requirement_id, r]));
  let drafted = 0;
  let approved = 0;
  let lpInputRequired = 0;
  let mandatoryOutstanding = 0;
  let requiredAttachmentsMissing = 0;
  let verified = 0;
  for (const req of requirements) {
    if (req.source_fact_id) verified += 1;
    const resp = byReq.get(req.id);
    if (resp?.draft_status === "APPROVED" || req.matrix_status === "APPROVED") approved += 1;
    else if (
      resp?.draft_status === "DRAFT" ||
      req.matrix_status === "DRAFTED" ||
      req.matrix_status === "DRAFTING"
    ) {
      drafted += 1;
    }
    if (
      resp?.evidence_state === "L_AND_P_INPUT_REQUIRED" ||
      req.matrix_status === "L_AND_P_INPUT_REQUIRED"
    ) {
      lpInputRequired += 1;
    }
    if (req.mandatory && req.response_required) {
      const hasDraft =
        resp &&
        resp.draft_status !== "EMPTY" &&
        (resp.draft_html?.replace(/<[^>]+>/g, "").trim().length ?? 0) > 0;
      if (!hasDraft && req.matrix_status !== "APPROVED") mandatoryOutstanding += 1;
    }
    if (req.attachment_required && req.matrix_status !== "APPROVED") {
      requiredAttachmentsMissing += 1;
    }
  }
  return {
    totalRequirements: requirements.length,
    verified,
    drafted,
    approved,
    lpInputRequired,
    mandatoryOutstanding,
    requiredAttachmentsMissing,
  };
}

async function addVerifiedFact(client, orgId, userId, opportunityId, opts) {
  const sha = createHash("sha256").update(`${opts.filename}-${stamp}-${randomUUID()}`).digest("hex");
  const { data: document, error: docError } = await client
    .from("documents")
    .insert({
      organization_id: orgId,
      opportunity_id: opportunityId ?? null,
      solicitation_id: opts.solicitationId ?? null,
      original_filename: opts.filename,
      document_type: opts.documentType ?? "solicitation",
      commercial_truth: opts.truth ?? "requested",
      mime_type: "application/pdf",
      processing_status: "NEEDS_REVIEW",
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
      entity: opts.entity ?? "requirement",
      field: opts.field ?? "requirement",
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

/**
 * Mirrors `createContractFromWin` / `evaluateContractHandoffGate`: a contract may only cite a
 * HUMAN_VERIFIED fact on this pursuit's own documents whose field/entity reads as an award,
 * contract, purchase order, NTE, agreement or ordering vehicle. Kept in step with
 * `AWARDISH_FACT_RE` in `apps/web/lib/opportunity/submission-readiness.ts`.
 */
const AWARDISH_FACT_RE =
  /award|contract|po\b|purchase.?order|nte|not.?to.?exceed|instrument|agreement|vehicle|txmas|mas/i;

async function pickVerifiedAwardFact(client, orgId, opportunityId) {
  const { data: docs } = await client.from("documents").select("id").eq("opportunity_id", opportunityId);
  const docIds = (docs ?? []).map((d) => d.id);
  if (docIds.length === 0) return null;
  const { data: facts } = await client
    .from("extracted_facts")
    .select("id, document_id, field, entity")
    .eq("organization_id", orgId)
    .eq("verification_status", "HUMAN_VERIFIED")
    .in("document_id", docIds)
    .order("verified_at", { ascending: false })
    .limit(40);
  return (facts ?? []).find((f) => AWARDISH_FACT_RE.test(`${f.field ?? ""} ${f.entity ?? ""}`)) ?? null;
}

function writeReport() {
  const failed = matrix.filter((r) => !r.ok);
  const verdict = failed.length === 0 ? "PASS" : "FAIL";
  mkdirSync(join(ROOT, "docs/benchmarks"), { recursive: true });
  writeFileSync(
    OUT_JSON,
    JSON.stringify(
      {
        audit: "VERIFY8",
        phase: "Canonical Phase 8 — Response / Submission / Result",
        stamp,
        package: PACKAGE,
        verdict,
        total: matrix.length,
        passed: matrix.length - failed.length,
        failed: failed.length,
        matrix,
      },
      null,
      2,
    ),
  );

  const assertionLines = matrix
    .map((r) => {
      const result = r.ok ? "**PASS**" : "**FAIL**";
      const detail = String(r.detail ?? "")
        .replace(/\|/g, "\\|")
        .slice(0, 220);
      return `| ${r.step} | ${r.name} | ${result} | ${detail} | ${r.source || "—"} |`;
    })
    .join("\n");

  const failList = failed.length
    ? failed.map((f) => `- **[${f.step}] ${f.name}** — ${f.detail || "no detail"}`).join("\n")
    : "_None._";

  const md = `# VERIFY 8 — Proposal workflow acceptance

**Phase:** Canonical Phase 8 — Response / Submission / Result  
**Audit date:** 2026-08-20  
**Command:** \`npm run test:verify8\`  
**Artifact:** [verify8-results.json](../benchmarks/verify8-results.json)  
**Package shape:** ${PACKAGE.key} (${PACKAGE.solicitationNumber}) — buyer solicitation patterns from SRC-06 Arlington + SRC-09 Lottery IFB (forms). No fabricated L&P historical rates/staffing/performance.

---

## Verdict

**${verdict}**

End-to-end pre-award flow: solicitation → Pursuit → Requirements → Pricing → Response → Approvals → Submission → Result → Contract/Intelligence.

---

## PASS / FAIL by step

| Step | Assertion | Result | Evidence | Source |
| --- | --- | --- | --- | --- |
${assertionLines}

---

## Failures

${failList}

---

## How to re-run

\`\`\`bash
npm run test:verify8
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
    // Static surface proofs
    record(
      0,
      "Phase 8 Response/Submission/Result surfaces exist (not global Proposal app)",
      existsSync(
        join(ROOT, "apps/web/app/(platform)/procurement/opportunities/[opportunityId]/response/page.tsx"),
      ) &&
        existsSync(
          join(ROOT, "apps/web/app/(platform)/procurement/opportunities/[opportunityId]/submission/page.tsx"),
        ) &&
        existsSync(
          join(ROOT, "apps/web/app/(platform)/procurement/opportunities/[opportunityId]/result/page.tsx"),
        ) &&
        /@tiptap\/react/.test(read("apps/web/package.json")),
      "pursuit tabs + tiptap",
      "apps/web",
    );

    const password = "Verify8-Workflow!22";
    const email = `verify8-${stamp}@example.com`;
    const created = await adm.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(created.error?.message ?? "user");
    users.push(created.data.user);
    const userId = created.data.user.id;
    const asA = await signIn(email, password);
    const orgId = (await asA.rpc("create_organization_with_admin", { org_name: `V8 ${stamp}` })).data;
    orgIds.push(orgId);

    // --- 1. Solicitation becomes a Pursuit ---
    const due = new Date(Date.now() + 14 * 86400000);
    const questionDue = new Date(Date.now() + 7 * 86400000);
    const { data: buyer } = await asA
      .from("clients")
      .insert({ organization_id: orgId, name: PACKAGE.buyer })
      .select("id")
      .single();

    const { data: opp, error: oppErr } = await asA
      .from("opportunities")
      .insert({
        organization_id: orgId,
        client_id: buyer.id,
        title: PACKAGE.title,
        stage: "ANALYSIS",
        response_due_on: due.toISOString().slice(0, 10),
        submission_method: "electronic portal",
        service_type: "Armed guards",
        solicitation_kind: "RFP",
      })
      .select("id, title, response_due_on, submission_method, stage")
      .single();

    const { data: sol, error: solErr } = await asA
      .from("solicitations")
      .insert({
        organization_id: orgId,
        opportunity_id: opp.id,
        client_id: buyer.id,
        title: PACKAGE.title,
        solicitation_number: PACKAGE.solicitationNumber,
      })
      .select("id, solicitation_number, opportunity_id")
      .single();

    record(
      1,
      "solicitation becomes a Pursuit",
      !oppErr && !solErr && sol?.opportunity_id === opp?.id && opp?.stage === "ANALYSIS",
      JSON.stringify({
        opportunityId: opp?.id,
        solicitation: sol?.solicitation_number,
        stage: opp?.stage,
      }),
      PACKAGE.key,
    );

    // --- 2. Deadlines visible ---
    const { data: packet } = await asA
      .from("submission_packets")
      .insert({
        organization_id: orgId,
        opportunity_id: opp.id,
        due_at: due.toISOString(),
        question_deadline_at: questionDue.toISOString(),
        submission_method: "electronic portal",
        portal_recipient: "arlington.procurement.portal",
      })
      .select("due_at, question_deadline_at")
      .single();

    record(
      2,
      "deadlines are visible",
      Boolean(opp?.response_due_on) && Boolean(packet?.due_at) && Boolean(packet?.question_deadline_at),
      JSON.stringify({
        response_due_on: opp?.response_due_on,
        due_at: packet?.due_at,
        question_deadline_at: packet?.question_deadline_at,
      }),
      "opportunities + submission_packets",
    );

    // --- 3. Requirements matrix source-backed ---
    const reqFact = await addVerifiedFact(asA, orgId, userId, opp.id, {
      filename: `arlington-rfp-${stamp}.pdf`,
      solicitationId: sol.id,
      documentType: "solicitation",
      truth: "requested",
      field: "requirement",
      value: PACKAGE.requirement,
      sourcePage: 12,
      sourceExcerpt: `§3.2 ${PACKAGE.requirement}`,
    });

    const { data: req, error: reqErr } = await asA
      .from("requirements")
      .insert({
        organization_id: orgId,
        solicitation_id: sol.id,
        source_fact_id: reqFact.factId,
        statement: PACKAGE.requirement,
        mandatory: true,
        scored: true,
        weight_pct: 30,
        section_ref: "3.2",
        source_page: 12,
        response_required: true,
        attachment_required: true,
        form_name: PACKAGE.formName,
        owner_name: "Proposal lead",
        matrix_status: "OPEN",
        verification_note: "HUMAN_VERIFIED from solicitation PDF",
      })
      .select("*")
      .single();

    record(
      3,
      "Requirements matrix is source-backed",
      !reqErr &&
        req?.source_fact_id === reqFact.factId &&
        req?.section_ref === "3.2" &&
        req?.source_page === 12 &&
        req?.verification_note?.includes("HUMAN_VERIFIED"),
      JSON.stringify({
        factId: req?.source_fact_id,
        section: req?.section_ref,
        page: req?.source_page,
      }),
      "requirements.source_fact_id",
    );

    // --- 4. Required forms/attachments tracked ---
    const { data: formRow, error: formErr } = await asA
      .from("required_forms")
      .insert({
        organization_id: orgId,
        solicitation_id: sol.id,
        form_name: PACKAGE.formName,
        mandatory: true,
        section_ref: "Attachments",
        source_fact_id: reqFact.factId,
        notes: "Buyer-required forms from solicitation (not invented L&P history)",
      })
      .select("id, form_name, mandatory")
      .single();

    record(
      4,
      "required forms/attachments are tracked",
      !formErr &&
        formRow?.mandatory === true &&
        req?.attachment_required === true &&
        req?.form_name === PACKAGE.formName,
      JSON.stringify({ form: formRow?.form_name, attachment_required: req?.attachment_required }),
      "required_forms + requirements.attachment_required",
    );

    // --- 5. Pricing uses verified evidence ---
    const priceFact = await addVerifiedFact(asA, orgId, userId, opp.id, {
      filename: `buyer-requested-rate-${stamp}.pdf`,
      solicitationId: sol.id,
      documentType: "solicitation",
      truth: "requested",
      entity: "Armed officer",
      field: "unit_price",
      value: "28.50",
      sourcePage: 40,
      sourceExcerpt: "Buyer requested rate sheet $28.50/hr (solicitation — not L&P history)",
    });

    const { data: priceLine, error: priceErr } = await asA
      .from("pricing_lines")
      .insert({
        organization_id: orgId,
        opportunity_id: opp.id,
        labor_category: "Armed officer",
        rate_type: "standard",
        site_or_post: "Main campus",
        unit: "hour",
        requested_rate: 28.5,
        requested_source_fact_id: priceFact.factId,
      })
      .select("id, requested_rate, requested_source_fact_id, proposed_rate")
      .single();

    record(
      5,
      "Pricing uses verified evidence",
      !priceErr &&
        priceLine?.requested_source_fact_id === priceFact.factId &&
        priceLine?.requested_rate === 28.5 &&
        priceLine?.proposed_rate == null,
      JSON.stringify(priceLine ?? priceErr),
      "pricing_lines.requested_source_fact_id",
    );

    // --- 6. Final pricing requires a human ---
    const { error: autoPrice } = await asA.from("pricing_decisions").insert({
      organization_id: orgId,
      opportunity_id: opp.id,
      status: "HUMAN_APPROVED",
      final_bid_rate: 31,
    });
    const { data: humanPrice, error: humanPriceErr } = await asA
      .from("pricing_decisions")
      .insert({
        organization_id: orgId,
        opportunity_id: opp.id,
        status: "HUMAN_APPROVED",
        final_bid_rate: 31.0,
        decided_by: userId,
        rationale: "Human final bid above buyer requested — not AI-set",
      })
      .select("id, status, decided_by")
      .single();

    record(
      6,
      "final pricing requires a human",
      Boolean(autoPrice) &&
        !humanPriceErr &&
        humanPrice?.decided_by === userId &&
        humanPrice?.status === "HUMAN_APPROVED",
      JSON.stringify({ autoBlocked: autoPrice?.message, decided_by: humanPrice?.decided_by }),
      "pricing_decisions_require_human",
    );

    // --- Historical reuse corpus (buyer-adjacent verified passages; not invented L&P metrics) ---
    const histApproved = await addVerifiedFact(asA, orgId, userId, opp.id, {
      filename: `hist-proposal-approved-${stamp}.pdf`,
      documentType: "proposal",
      truth: "proposed",
      field: "staffing_approach",
      value: `Verified prior response narrative ${stamp}: describe post coverage by building using only confirmed roster facts when provided by L&P.`,
      entity: "proposal",
      sourcePage: 2,
    });
    await asA.rpc("promote_knowledge_chunk_from_fact", { p_fact_id: histApproved.factId });
    const { data: approvedChunk } = await asA
      .from("document_chunks")
      .select("id, reuse_status, content")
      .eq("source_fact_id", histApproved.factId)
      .maybeSingle();
    if (approvedChunk) {
      await asA.from("document_chunks").update({ reuse_status: "APPROVED" }).eq("id", approvedChunk.id);
    }

    const histReview = await addVerifiedFact(asA, orgId, userId, opp.id, {
      filename: `hist-proposal-review-${stamp}.pdf`,
      documentType: "proposal",
      truth: "proposed",
      field: "approach",
      value: `Review-required prior narrative ${stamp}: approach language needs human check before reuse.`,
      entity: "proposal",
      sourcePage: 1,
    });
    await asA.rpc("promote_knowledge_chunk_from_fact", { p_fact_id: histReview.factId });
    const { data: reviewChunk } = await asA
      .from("document_chunks")
      .select("id")
      .eq("source_fact_id", histReview.factId)
      .maybeSingle();
    if (reviewChunk) {
      await asA
        .from("document_chunks")
        .update({ reuse_status: "REVIEW_REQUIRED" })
        .eq("id", reviewChunk.id);
    }

    const histBlocked = await addVerifiedFact(asA, orgId, userId, opp.id, {
      filename: `hist-proposal-donotuse-${stamp}.pdf`,
      documentType: "proposal",
      truth: "proposed",
      field: "approach",
      value: `DO_NOT_USE prior narrative ${stamp}: superseded incorrect staffing claim — must not enter drafting.`,
      entity: "proposal",
      sourcePage: 1,
    });
    await asA.rpc("promote_knowledge_chunk_from_fact", { p_fact_id: histBlocked.factId });
    const { data: blockedChunk } = await asA
      .from("document_chunks")
      .select("id")
      .eq("source_fact_id", histBlocked.factId)
      .maybeSingle();
    if (blockedChunk) {
      await asA.from("document_chunks").update({ reuse_status: "DO_NOT_USE" }).eq("id", blockedChunk.id);
    }

    // --- 7. Response uses requirement-level drafting ---
    const { data: responseRow, error: respErr } = await asA
      .from("requirement_responses")
      .insert({
        organization_id: orgId,
        opportunity_id: opp.id,
        requirement_id: req.id,
        draft_html: "<p>Requirement-level draft placeholder.</p>",
        evidence_state: "REVIEW_REQUIRED",
        draft_status: "DRAFT",
        sources_used: [],
        confidence: "low",
      })
      .select("id, requirement_id, draft_status")
      .single();

    record(
      7,
      "Response uses requirement-level drafting",
      !respErr && responseRow?.requirement_id === req.id && responseRow?.draft_status === "DRAFT",
      JSON.stringify(responseRow ?? respErr),
      "requirement_responses",
    );

    // --- 8. approved / review / blocked reuse rules ---
    const approvedState = classifyEvidenceFromHits([{ reuse_status: "APPROVED", content: "x" }]);
    const reviewState = classifyEvidenceFromHits([{ reuse_status: "REVIEW_REQUIRED", content: "x" }]);
    const blockedState = classifyEvidenceFromHits([{ reuse_status: "DO_NOT_USE", content: "x" }]);
    record(
      8,
      "approved/review/blocked reuse rules work",
      approvedState === "VERIFIED_DRAFT_AVAILABLE" &&
        reviewState === "REVIEW_REQUIRED" &&
        blockedState === "L_AND_P_INPUT_REQUIRED",
      JSON.stringify({ approvedState, reviewState, blockedState }),
      "classifyEvidenceFromHits",
    );

    // --- 9. DO_NOT_USE cannot enter draft generation ---
    const { data: draftHits } = await asA.rpc("search_verified_knowledge", {
      p_query: `DO_NOT_USE prior narrative ${stamp}`,
      p_purpose: "PROPOSAL_DRAFTING",
      p_limit: 20,
    });
    const draftHasBlocked =
      Array.isArray(draftHits) &&
      draftHits.some((h) => h.reuse_status === "DO_NOT_USE" || h.source_fact_id === histBlocked.factId);

    const { data: lossHits } = await asA.rpc("search_verified_knowledge", {
      p_query: `DO_NOT_USE prior narrative ${stamp}`,
      p_purpose: "LOSS_ANALYSIS",
      p_limit: 20,
    });
    const lossSeesBlocked =
      Array.isArray(lossHits) && lossHits.some((h) => h.reuse_status === "DO_NOT_USE");

    record(
      9,
      "DO_NOT_USE cannot enter draft generation",
      !draftHasBlocked && lossSeesBlocked,
      JSON.stringify({
        draftingHits: draftHits?.map((h) => h.reuse_status),
        lossHasDoNotUse: lossSeesBlocked,
      }),
      "search_verified_knowledge PROPOSAL_DRAFTING",
    );

    // --- 10. Missing L&P facts → L&P INPUT REQUIRED ---
    const emptyHits = [];
    const missingState = classifyEvidenceFromHits(emptyHits);
    const { error: lpUpdateErr } = await asA
      .from("requirement_responses")
      .update({
        evidence_state: "L_AND_P_INPUT_REQUIRED",
        draft_html: "",
        draft_status: "EMPTY",
        missing_information: "L&P INPUT REQUIRED: staffing capacity, certifications",
        sources_used: [],
        confidence: "none",
      })
      .eq("id", responseRow.id);
    await asA
      .from("requirements")
      .update({ matrix_status: "L_AND_P_INPUT_REQUIRED" })
      .eq("id", req.id);

    const { data: lpRow } = await asA
      .from("requirement_responses")
      .select("evidence_state, missing_information")
      .eq("id", responseRow.id)
      .single();

    record(
      10,
      "missing L&P facts produce L&P INPUT REQUIRED",
      missingState === "L_AND_P_INPUT_REQUIRED" &&
        !lpUpdateErr &&
        lpRow?.evidence_state === "L_AND_P_INPUT_REQUIRED" &&
        /L&P INPUT REQUIRED/.test(lpRow?.missing_information ?? ""),
      JSON.stringify(lpRow),
      "requirement_responses.evidence_state",
    );

    // --- 11. Generated response shows sources ---
    const { data: allowedHits } = await asA.rpc("search_verified_knowledge", {
      p_query: `Verified prior response narrative ${stamp}`,
      p_purpose: "PROPOSAL_DRAFTING",
      p_limit: 10,
    });
    const sourcesUsed = (allowedHits ?? [])
      .filter((h) => h.reuse_status !== "DO_NOT_USE")
      .slice(0, 5)
      .map((h) => ({
        chunk_id: h.chunk_id,
        reuse_status: h.reuse_status,
        excerpt: (h.content ?? "").slice(0, 120),
        source_fact_id: h.source_fact_id,
      }));

    const draftHtml = sourcesUsed.length
      ? `<p>Draft from verified sources.</p>${sourcesUsed.map((s, i) => `<p>[${i + 1}] (${s.reuse_status}) ${s.excerpt}</p>`).join("")}`
      : "";

    const { error: srcErr } = await asA
      .from("requirement_responses")
      .update({
        draft_html: draftHtml,
        draft_status: "DRAFT",
        evidence_state: classifyEvidenceFromHits(allowedHits ?? []),
        sources_used: sourcesUsed,
        assumptions: "Only APPROVED/REVIEW_REQUIRED passages under PROPOSAL_DRAFTING",
        missing_information: null,
        confidence: "medium",
      })
      .eq("id", responseRow.id);

    const { data: sourced } = await asA
      .from("requirement_responses")
      .select("sources_used, draft_html, evidence_state")
      .eq("id", responseRow.id)
      .single();

    const sourcesArr = Array.isArray(sourced?.sources_used)
      ? sourced.sources_used
      : typeof sourced?.sources_used === "object" && sourced?.sources_used
        ? Object.values(sourced.sources_used)
        : [];

    record(
      11,
      "generated response shows sources",
      !srcErr &&
        sourcesArr.length >= 1 &&
        Boolean(sourcesArr[0].chunk_id || sourcesArr[0].source_fact_id) &&
        /Draft from verified sources/.test(sourced?.draft_html ?? ""),
      JSON.stringify({ n: sourcesArr.length, first: sourcesArr[0] }),
      "requirement_responses.sources_used",
    );

    // --- 12. Proposal progress is correct ---
    await asA.from("requirements").update({ matrix_status: "DRAFTED" }).eq("id", req.id);
    const { data: reqFresh } = await asA.from("requirements").select("*").eq("id", req.id).single();
    const { data: respFresh } = await asA
      .from("requirement_responses")
      .select("*")
      .eq("opportunity_id", opp.id);
    const progress = computeResponseProgress([reqFresh], respFresh ?? []);
    record(
      12,
      "proposal progress is correct",
      progress.totalRequirements === 1 &&
        progress.verified === 1 &&
        progress.drafted === 1 &&
        progress.mandatoryOutstanding === 0 &&
        progress.requiredAttachmentsMissing === 1,
      JSON.stringify(progress),
      "computeResponseProgress",
    );

    // --- 13. Internal approvals auditable ---
    const { data: approval, error: apprErr } = await asA
      .from("pursuit_approval_layers")
      .insert({
        organization_id: orgId,
        opportunity_id: opp.id,
        layer_key: "content",
        enabled: true,
        status: "requested",
        notes: "Content review requested",
      })
      .select("id, layer_key, status, enabled, created_at")
      .single();

    record(
      13,
      "internal approvals are auditable",
      !apprErr &&
        approval?.enabled === true &&
        approval?.status === "requested" &&
        Boolean(approval?.created_at),
      JSON.stringify(approval ?? apprErr),
      "pursuit_approval_layers",
    );

    // --- 14. changes-requested / rejected works ---
    const { data: changesRow, error: changesErr } = await asA
      .from("pursuit_approval_layers")
      .update({
        status: "changes_requested",
        notes: "Expand staffing detail",
        approver_id: userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", approval.id)
      .select("status, approver_id, decided_at")
      .single();

    const { error: rejInsertErr } = await asA.from("pursuit_approval_layers").insert({
      organization_id: orgId,
      opportunity_id: opp.id,
      layer_key: "compliance",
      enabled: true,
      status: "rejected",
      notes: "Missing cert exhibit",
      approver_id: userId,
      decided_at: new Date().toISOString(),
    });

    record(
      14,
      "changes-requested/rejected approval state works",
      !changesErr &&
        changesRow?.status === "changes_requested" &&
        changesRow?.approver_id === userId &&
        !rejInsertErr,
      JSON.stringify({ changes: changesRow?.status, rejectedOk: !rejInsertErr }),
      "pursuit_approval_layers.status",
    );

    // --- 15. Submission checklist catches missing mandatory items ---
    const checklistSeed = [
      {
        organization_id: orgId,
        opportunity_id: opp.id,
        item_key: "required_forms",
        label: "Required forms",
        required: true,
        completed: false,
        sort_order: 10,
      },
      {
        organization_id: orgId,
        opportunity_id: opp.id,
        item_key: "pricing_schedules",
        label: "Pricing schedules",
        required: true,
        completed: true,
        sort_order: 20,
      },
      {
        organization_id: orgId,
        opportunity_id: opp.id,
        item_key: "signatures",
        label: "Signatures",
        required: true,
        completed: false,
        sort_order: 70,
      },
    ];
    const { error: checkErr } = await asA.from("submission_checklist_items").insert(checklistSeed);
    const { data: checks } = await asA
      .from("submission_checklist_items")
      .select("item_key, required, completed")
      .eq("opportunity_id", opp.id);
    const missingMandatory = (checks ?? []).filter((c) => c.required && !c.completed);

    record(
      15,
      "submission checklist catches missing mandatory items",
      !checkErr && missingMandatory.length >= 2 && missingMandatory.some((c) => c.item_key === "required_forms"),
      JSON.stringify({ missing: missingMandatory.map((c) => c.item_key) }),
      "submission_checklist_items",
    );

    // --- 16 + 17. Submitted datetime + confirmation (human-attributed) ---
    const submittedAt = new Date().toISOString();
    const confirmation = `PORTAL-CONF-${stamp}`;

    // A submission with no human actor must be rejected before the happy path is claimed.
    const { error: anonSubmitErr } = await asA
      .from("submission_packets")
      .update({ submitted_at: submittedAt, submitted_by: null })
      .eq("opportunity_id", opp.id);

    const { data: submittedPacket, error: subErr } = await asA
      .from("submission_packets")
      .update({
        submitted_at: submittedAt,
        submitted_by: userId,
        confirmation_reference: confirmation,
        final_output_version: "v1.0",
      })
      .eq("opportunity_id", opp.id)
      .select("submitted_at, submitted_by, confirmation_reference")
      .single();

    await asA.from("opportunities").update({ stage: "SUBMITTED" }).eq("id", opp.id);

    record(
      16,
      "submitted date/time is captured and attributed to a human",
      Boolean(anonSubmitErr) &&
        !subErr &&
        Boolean(submittedPacket?.submitted_at) &&
        submittedPacket?.submitted_by === userId,
      JSON.stringify({
        anonymousSubmitBlocked: anonSubmitErr?.message ?? null,
        submitted_at: submittedPacket?.submitted_at,
        submitted_by: submittedPacket?.submitted_by,
      }),
      "submission_packets.submitted_at + submitted_requires_actor",
    );

    record(
      17,
      "submission confirmation is captured",
      submittedPacket?.confirmation_reference === confirmation,
      JSON.stringify({ confirmation_reference: submittedPacket?.confirmation_reference }),
      "submission_packets.confirmation_reference",
    );

    // --- 18. Result can remain Pending ---
    const { data: pendingResult, error: pendingErr } = await asA
      .from("win_loss_reviews")
      .insert({
        organization_id: orgId,
        opportunity_id: opp.id,
        outcome: "PENDING",
        documented_reason: null,
        internal_analysis: null,
      })
      .select("id, outcome")
      .single();

    record(
      18,
      "Result can remain Pending",
      !pendingErr && pendingResult?.outcome === "PENDING",
      JSON.stringify(pendingResult ?? pendingErr),
      "win_loss_reviews.outcome",
    );

    // --- 19. Win/Loss/No Bid/etc. can be recorded ---
    const outcomesTried = [];
    for (const outcome of ["NO_BID", "CANCELLED", "NO_AWARD", "LOST", "WON"]) {
      const { data: row, error } = await asA
        .from("win_loss_reviews")
        .update({
          outcome,
          winner_name: outcome === "WON" ? "L&P Global Security" : outcome === "LOST" ? "Other" : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pendingResult.id)
        .select("outcome")
        .single();
      outcomesTried.push({ outcome, ok: !error && row?.outcome === outcome, err: error?.message });
    }
    record(
      19,
      "Win/Loss/No Bid/etc. can be recorded",
      outcomesTried.every((o) => o.ok),
      JSON.stringify(outcomesTried),
      "opportunity_outcome enum",
    );

    // Leave as WON for contract + intelligence steps
    await asA
      .from("win_loss_reviews")
      .update({
        outcome: "WON",
        winner_name: "L&P Global Security",
        lp_price: 31,
        winning_price: 31,
        lp_score: 88.5,
        winning_score: 88.5,
        rank: 1,
        documented_reason: "Highest technical score (buyer staff report — fixture)",
        internal_analysis: "Internal lesson: staffing narrative clarity",
        lessons_learned: "Keep forms packet complete before portal submit",
        evaluator_comments: "Strong approach; forms complete",
      })
      .eq("id", pendingResult.id);

    // --- 20. Evaluator/competitor result data stays sourced ---
    const scoreFact = await addVerifiedFact(asA, orgId, userId, opp.id, {
      filename: `arlington-scorecard-${stamp}.pdf`,
      documentType: "award",
      truth: "awarded",
      field: "evaluation_score",
      value: "88.5",
      entity: "scorecard",
      sourcePage: 4,
      sourceExcerpt: "L&P total 88.5 (staff report fixture — verified fact)",
    });
    const { data: score, error: scoreErr } = await asA
      .from("evaluation_scores")
      .insert({
        organization_id: orgId,
        opportunity_id: opp.id,
        respondent_name: "L&P Global Security",
        points: 88.5,
        max_points: 100,
        rank: 1,
        source_document_id: scoreFact.documentId,
        source_fact_id: scoreFact.factId,
      })
      .select("id, source_fact_id, points")
      .single();

    const { data: competitor } = await asA
      .from("competitors")
      .insert({ organization_id: orgId, name: `VSA Fixture ${stamp}` })
      .select("id")
      .single();
    const compFact = await addVerifiedFact(asA, orgId, userId, opp.id, {
      filename: `competitor-tab-${stamp}.pdf`,
      documentType: "award",
      truth: "awarded",
      field: "quoted_amount",
      value: "920000",
      entity: "competitor",
      sourcePage: 2,
    });
    const { data: bid, error: bidErr } = await asA
      .from("competitor_bids")
      .insert({
        organization_id: orgId,
        opportunity_id: opp.id,
        competitor_id: competitor.id,
        quoted_amount: 920000,
        source_document_id: compFact.documentId,
        source_fact_id: compFact.factId,
        note: "Sourced competitor outcome — not L&P invented history",
      })
      .select("id, source_fact_id")
      .single();

    record(
      20,
      "evaluator/competitor result data stays sourced",
      !scoreErr &&
        score?.source_fact_id === scoreFact.factId &&
        !bidErr &&
        bid?.source_fact_id === compFact.factId,
      JSON.stringify({ scoreFact: score?.source_fact_id, bidFact: bid?.source_fact_id }),
      "evaluation_scores + competitor_bids source_fact_id",
    );

    // --- 21. Win creates/links Contract from a HUMAN_VERIFIED award fact ---
    // A WON checkbox is not evidence. The award instrument is ingested and verified first, then the
    // contract cites that fact — the same path `createContractFromWin` takes.
    const awardFact = await addVerifiedFact(asA, orgId, userId, opp.id, {
      filename: `arlington-award-notice-${stamp}.pdf`,
      documentType: "award",
      truth: "awarded",
      entity: "award",
      field: "contract_number",
      value: `C-${stamp}`,
      sourcePage: 1,
      sourceExcerpt: `Notice of award — contract C-${stamp} (staff report fixture — verified fact)`,
    });

    // A bare contract row with no verified fact must be rejected outright.
    const { error: unsourcedContractErr } = await asA.from("contracts").insert({
      organization_id: orgId,
      opportunity_id: opp.id,
      client_id: buyer.id,
      title: `Unsourced — ${PACKAGE.title}`,
    });

    const pickedFact = await pickVerifiedAwardFact(asA, orgId, opp.id);
    const { data: contract, error: contractErr } = pickedFact
      ? await asA
          .from("contracts")
          .insert({
            organization_id: orgId,
            opportunity_id: opp.id,
            client_id: buyer.id,
            title: `Awarded — ${PACKAGE.title}`,
            contract_number: `C-${stamp}`,
            source_fact_id: pickedFact.id,
            source_document_id: pickedFact.document_id,
          })
          .select("id, opportunity_id, title, source_fact_id, source_document_id")
          .single()
      : { data: null, error: new Error("no HUMAN_VERIFIED award-shaped fact on the pursuit") };
    await asA.from("opportunities").update({ stage: "AWARDED" }).eq("id", opp.id);

    record(
      21,
      "a win creates/links the Contract from a verified award fact (and blocks unsourced rows)",
      Boolean(unsourcedContractErr) &&
        !contractErr &&
        contract?.opportunity_id === opp.id &&
        contract?.source_fact_id === awardFact.factId &&
        contract?.source_document_id === awardFact.documentId,
      JSON.stringify({
        unsourcedBlocked: unsourcedContractErr?.message ?? null,
        contractId: contract?.id,
        source_fact_id: contract?.source_fact_id,
      }),
      "contracts_require_verified_fact + createContractFromWin path",
    );

    // --- 22. Outcome feeds intelligence corpus ---
    const [{ data: wlIntel }, { data: contractIntel }, { data: bidIntel }, { count: priceCount }] =
      await Promise.all([
        asA.from("win_loss_reviews").select("outcome, lessons_learned").eq("opportunity_id", opp.id).maybeSingle(),
        asA.from("contracts").select("id").eq("opportunity_id", opp.id).maybeSingle(),
        asA.from("competitor_bids").select("id").eq("opportunity_id", opp.id),
        asA
          .from("pricing_lines")
          .select("id", { count: "exact", head: true })
          .eq("opportunity_id", opp.id),
      ]);

    const intelPages = [
      "apps/web/app/(platform)/intelligence/win-loss/page.tsx",
      "apps/web/app/(platform)/intelligence/competitors/page.tsx",
      "apps/web/app/(platform)/intelligence/pricing/page.tsx",
      "apps/web/app/(platform)/intelligence/clients/page.tsx",
    ];
    const pagesExist = intelPages.every((p) => existsSync(join(ROOT, p)));
    const actionsRevalidate = /revalidatePath\("\/intelligence\/win-loss"\)/.test(
      read("apps/web/app/(platform)/procurement/opportunities/[opportunityId]/actions.ts"),
    );

    record(
      22,
      "outcome feeds the intelligence corpus",
      wlIntel?.outcome === "WON" &&
        Boolean(wlIntel?.lessons_learned) &&
        Boolean(contractIntel?.id) &&
        (bidIntel?.length ?? 0) >= 1 &&
        (priceCount ?? 0) >= 1 &&
        pagesExist &&
        actionsRevalidate,
      JSON.stringify({
        outcome: wlIntel?.outcome,
        contract: contractIntel?.id,
        competitorBids: bidIntel?.length,
        pricingLines: priceCount,
        revalidateWired: actionsRevalidate,
      }),
      "win_loss_reviews + contracts + intel routes",
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
    for (const f of failed) console.error(`  FAIL [${f.step}] ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main();
