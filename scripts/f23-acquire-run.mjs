#!/usr/bin/env node
/**
 * F23 — Public corpus acquisition run.
 *
 * Seed F23A registry → fetch → checksum → vault ingest when PDF/DOCX/XLSX →
 * write docs/corpus/ACQUISITION_RUN.md (+ coverage / saturation docs).
 *
 * Run: npm run corpus:acquire
 *      node --env-file=apps/web/.env.local scripts/f23-acquire-run.mjs
 *
 * Never HUMAN_VERIFIED. Never fabricate. Never commit binaries.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as esbuild from "esbuild";
import os from "node:os";
import fs from "node:fs/promises";

const ROOT = join(import.meta.dirname, "..");
const REGISTRY = join(ROOT, "docs/corpus/F23A_Exact_Public_Source_URL_Registry.txt");
const DOWNLOAD_DIR = join(ROOT, "docs/corpus/downloads");
const PILOT_ACQUIRED = join(ROOT, "docs/pilot/acquired");
const RUN_MD = join(ROOT, "docs/corpus/ACQUISITION_RUN.md");
const COVERAGE_MD = join(ROOT, "docs/corpus/CORPUS_COVERAGE.md");
const SATURATION_MD = join(ROOT, "docs/corpus/ACQUISITION_SATURATION.md");
const PROVIDER_MD = join(ROOT, "docs/corpus/SOURCE_PROVIDER_REGISTRY.md");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const email = process.env.LP_OPERATOR_EMAIL?.trim();
const password = process.env.LP_OPERATOR_PASSWORD;
const orgName = process.env.LP_OPERATOR_ORG_NAME?.trim() || "L&P Global Security";
const samKey = (process.env.SAM_GOV_API_KEY ?? process.env.SAM_API_KEY ?? "").trim();
const skipIngest = (process.env.F23_SKIP_INGEST ?? "").trim() === "1";
const skipFetch = (process.env.F23_SKIP_FETCH ?? "").trim() === "1";

if (!url || !publishable || !secret) {
  console.error("Missing Supabase env. Use --env-file=apps/web/.env.local");
  process.exit(1);
}

async function bundleCorpus() {
  const webRoot = join(ROOT, "apps/web");
  const outfile = join(await fs.mkdtemp(join(os.tmpdir(), "lp-f23-")), "corpus.mjs");
  await esbuild.build({
    entryPoints: [join(webRoot, "lib/corpus/index.ts")],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    logLevel: "warning",
    alias: { "@": webRoot },
  });
  return import(pathToFileURL(outfile).href);
}

function admin() {
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

function anon() {
  return createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveOrg(adminClient) {
  if (email && password) {
    const client = anon();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error(error?.message ?? "operator sign-in failed");
    const { data: memberships, error: mErr } = await adminClient
      .from("memberships")
      .select("organization_id, role")
      .eq("user_id", data.user.id);
    if (mErr) throw new Error(mErr.message);
    if (!memberships?.length) throw new Error("Operator has no organization membership");
    const orgIds = memberships.map((m) => m.organization_id);
    const { data: orgs } = await adminClient
      .from("organizations")
      .select("id, name")
      .in("id", orgIds);
    const named = orgs?.find((o) => o.name === orgName) ?? orgs?.[0];
    if (!named) throw new Error("Operator org row missing");
    return { orgId: named.id, userId: data.user.id, userClient: client };
  }
  const { data: orgs, error } = await adminClient
    .from("organizations")
    .select("id, name")
    .ilike("name", `%${orgName}%`)
    .limit(1);
  if (error || !orgs?.[0]) throw new Error(error?.message ?? "org not found");
  return { orgId: orgs[0].id, userId: null, userClient: adminClient };
}

function packageKeyFor(seed) {
  const buyer = (seed.buyerName ?? "unknown")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return `F23-${seed.seedId}-${buyer}`.toUpperCase();
}

function preferLinkOnly(seed) {
  if (seed.downloadableHint) return false;
  const u = seed.url.toLowerCase();
  if (/\.(pdf|docx?|xlsx?|xls)(\?|$)/i.test(u)) return false;
  if (
    /sam\.gov\/opportunities\/?$|sam\.gov\/contracting|gsaelibrary|txsmartbuy\.gov\/(esbd|vpts|purchase)|comptroller\.texas\.gov|tops\.portal\.texas\.gov|data\.texas\.gov\/dataset|lancasterisd\.community\.diligentoneplatform\.com\/Portal\/VotingRecords|open\.gsa\.gov|api\.sam\.gov|api\.usaspending\.gov\/?$/i.test(
      u,
    )
  ) {
    return true;
  }
  // API docs / autocomplete roots
  if (/\/docs\/|\/autocomplete\//i.test(u)) return true;
  return !seed.downloadableHint && /^[AB]\./.test(seed.section);
}

function hashUrl(url) {
  let u = String(url).trim().replace(/[.,;:!?)\]>]+$/g, "");
  try {
    const parsed = new URL(u);
    parsed.hash = "";
    u = parsed.toString();
  } catch {
    /* keep */
  }
  return createHash("sha256").update(u).digest("hex");
}

async function upsertCandidate(db, orgId, seed, classified, extra = {}) {
  const url_hash = hashUrl(seed.url);
  const row = {
    organization_id: orgId,
    corpus_role: classified.corpusRole,
    source_authority: classified.sourceAuthority,
    url: seed.url,
    url_hash,
    title: seed.title,
    buyer_name: seed.buyerName,
    solicitation_hints: seed.solicitationHints ?? {},
    status: extra.status ?? "DISCOVERED",
    sha256: extra.sha256 ?? null,
    document_id: extra.document_id ?? null,
    package_key: extra.package_key ?? packageKeyFor(seed),
    local_path: extra.local_path ?? null,
    byte_size: extra.byte_size ?? null,
    content_type: extra.content_type ?? null,
    retrieved_at: extra.retrieved_at ?? null,
    last_error: extra.last_error ?? null,
    search_log: extra.search_log ?? [],
    seed_section: seed.section,
    seed_id: seed.seedId,
    provider: extra.provider ?? "f23a_registry",
    external_id: seed.seedId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from("acquisition_candidates")
    .upsert(row, { onConflict: "organization_id,url_hash" })
    .select("*")
    .maybeSingle();
  if (error) {
    // Fallback: select + update
    const existing = await db
      .from("acquisition_candidates")
      .select("id")
      .eq("organization_id", orgId)
      .eq("url_hash", url_hash)
      .maybeSingle();
    if (existing.data?.id) {
      const upd = await db
        .from("acquisition_candidates")
        .update(row)
        .eq("id", existing.data.id)
        .select("*")
        .maybeSingle();
      if (upd.error) throw new Error(upd.error.message);
      return upd.data;
    }
    const ins = await db.from("acquisition_candidates").insert(row).select("*").maybeSingle();
    if (ins.error) throw new Error(ins.error.message);
    return ins.data;
  }
  return data;
}

async function logSaturation(db, orgId, entry) {
  const { error } = await db.from("acquisition_saturation_runs").insert({
    organization_id: orgId,
    provider: entry.provider,
    query: entry.query,
    buyer_or_entity: entry.buyer_or_entity ?? null,
    result_count: entry.result_count ?? null,
    mode: entry.mode ?? "live",
    notes: entry.notes ?? null,
    raw_summary: entry.raw_summary ?? {},
    attempted_at: entry.attempted_at ?? new Date().toISOString(),
  });
  if (error) console.warn("saturation log:", error.message);
}

async function runUsaSpending(db, orgId, corpus) {
  const endpoint = "https://api.usaspending.gov/api/v2/search/spending_by_award/";
  const queries = [
    { label: "L&P Global Security", filters: { recipient_search_text: ["L&P Global Security"] } },
    { label: "NAICS 561612", filters: { naics_codes: ["561612"] } },
  ];
  const results = [];

  for (const q of queries) {
    const body = {
      filters: {
        award_type_codes: ["A", "B", "C", "D"],
        ...q.filters,
      },
      fields: [
        "Award ID",
        "Recipient Name",
        "Awarding Agency",
        "Award Amount",
        "Start Date",
        "End Date",
        "NAICS Code",
        "Description",
      ],
      page: 1,
      limit: 25,
      sort: "Award Amount",
      order: "desc",
    };
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      const rows = Array.isArray(json.results) ? json.results : [];
      await logSaturation(db, orgId, {
        provider: "usa_spending",
        query: q.label,
        buyer_or_entity: q.label,
        result_count: rows.length,
        mode: "live",
        notes: res.ok
          ? `spending_by_award page1 limit25 — REFERENCE_DATA only`
          : `HTTP ${res.status}`,
        raw_summary: { http: res.status, hasNext: json.page_metadata?.hasNext ?? null },
      });

      for (const award of rows.slice(0, 10)) {
        const awardId = award["Award ID"] ?? award.generated_unique_award_id ?? randomUUID();
        const sourceUrl = `https://www.usaspending.gov/award/${encodeURIComponent(String(award.generated_unique_award_id ?? awardId))}`;
        const title = `${award["Recipient Name"] ?? "Recipient"} — ${awardId}`;
        const seed = {
          seedId: `USA-${String(awardId).slice(0, 24)}`,
          section: "A. FEDERAL — USAspending",
          url: sourceUrl,
          title,
          buyerName: award["Awarding Agency"] ?? null,
          solicitationHints: {
            naics: award["NAICS Code"] ?? null,
            amount: award["Award Amount"] ?? null,
            reference: true,
          },
          roleHint: "REFERENCE_DATA",
          authorityHint: 2,
          downloadableHint: false,
        };
        const classified = corpus.classifyCorpusRole({
          url: sourceUrl,
          title,
          buyerName: seed.buyerName,
          structuredReference: true,
        });
        await upsertCandidate(db, orgId, seed, classified, {
          status: "LINK_ONLY",
          provider: "usa_spending",
          last_error: null,
          search_log: [
            {
              query: q.label,
              provider: "usa_spending",
              attempted_at: new Date().toISOString(),
              result_count: rows.length,
              note: "Award portal link — structured REFERENCE_DATA, not a fabricated package PDF.",
            },
          ],
        });
        results.push({ query: q.label, awardId, sourceUrl });
      }
      console.log(`USAspending ${q.label}: ${rows.length} results (recorded up to 10)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await logSaturation(db, orgId, {
        provider: "usa_spending",
        query: q.label,
        buyer_or_entity: q.label,
        result_count: null,
        mode: "live",
        notes: `FAILED: ${msg.slice(0, 200)}`,
      });
      console.warn(`USAspending ${q.label} failed:`, msg);
    }
  }
  return results;
}

async function runSam(db, orgId, corpus) {
  if (!samKey) {
    await logSaturation(db, orgId, {
      provider: "sam_gov",
      query: "L&P Global Security / NAICS 561612",
      buyer_or_entity: "L&P Global Security",
      result_count: null,
      mode: "skipped",
      notes: "SAM_GOV_API_KEY not set — MANUAL/LINK only. No fixture rows persisted as live.",
    });
    const seed = {
      seedId: "SAM-MANUAL",
      section: "A. FEDERAL — SAM.gov",
      url: "https://sam.gov/opportunities",
      title: "SAM.gov opportunities — MANUAL (no API key)",
      buyerName: "Federal",
      solicitationHints: {},
      roleHint: "REFERENCE_DATA",
      authorityHint: 2,
      downloadableHint: false,
    };
    await upsertCandidate(
      db,
      orgId,
      seed,
      { corpusRole: "REFERENCE_DATA", sourceAuthority: 2, reason: "SAM portal bookmark" },
      { status: "MANUAL_IMPORT", provider: "sam_gov", last_error: "SAM_GOV_API_KEY unset" },
    );
    console.log("SAM.gov: MANUAL/LINK (no API key)");
    return { mode: "manual", count: 0 };
  }

  const endpoint = new URL("https://api.sam.gov/opportunities/v2/search");
  endpoint.searchParams.set("api_key", samKey);
  endpoint.searchParams.set("keyword", "security guard");
  endpoint.searchParams.set("limit", "10");
  endpoint.searchParams.set("postedFrom", "01/01/2024");
  endpoint.searchParams.set("postedTo", "12/31/2026");

  try {
    const res = await fetch(endpoint.toString(), {
      headers: { accept: "application/json" },
    });
    const json = await res.json().catch(() => ({}));
    const opps = Array.isArray(json.opportunitiesData) ? json.opportunitiesData : [];
    await logSaturation(db, orgId, {
      provider: "sam_gov",
      query: "security guard",
      buyer_or_entity: "Federal",
      result_count: opps.length,
      mode: "live",
      notes: res.ok ? "Public opportunities search" : `HTTP ${res.status}`,
    });
    for (const opp of opps.slice(0, 10)) {
      const sourceUrl = opp.uiLink || `https://sam.gov/opp/${opp.noticeId}/view`;
      const seed = {
        seedId: `SAM-${opp.noticeId ?? randomUUID().slice(0, 8)}`,
        section: "A. FEDERAL — SAM.gov",
        url: sourceUrl,
        title: opp.title ?? "SAM opportunity",
        buyerName: opp.fullParentPathName ?? opp.organizationName ?? null,
        solicitationHints: { solicitation: opp.solicitationNumber ?? null },
        roleHint: "COMPARABLE_SECURITY",
        authorityHint: 2,
        downloadableHint: false,
      };
      const classified = corpus.classifyCorpusRole({
        url: sourceUrl,
        title: seed.title,
        buyerName: seed.buyerName,
      });
      await upsertCandidate(db, orgId, seed, classified, {
        status: "LINK_ONLY",
        provider: "sam_gov",
      });
    }
    console.log(`SAM.gov live: ${opps.length} notices`);
    return { mode: "live", count: opps.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logSaturation(db, orgId, {
      provider: "sam_gov",
      query: "security guard",
      buyer_or_entity: "Federal",
      result_count: null,
      mode: "live",
      notes: `FAILED: ${msg.slice(0, 200)}`,
    });
    return { mode: "failed", count: 0 };
  }
}

async function runSocrataTxdot(db, orgId, corpus) {
  // TxDOT Bid Tabulations dataset de7b-7dna on data.texas.gov
  const soda = "https://data.texas.gov/resource/de7b-7dna.json?$limit=15";
  try {
    const res = await fetch(soda, {
      headers: { accept: "application/json", "user-agent": "ContractIntelligencePlatform/F23" },
    });
    const rows = res.ok ? await res.json().catch(() => []) : [];
    const list = Array.isArray(rows) ? rows : [];
    await logSaturation(db, orgId, {
      provider: "socrata",
      query: "TxDOT Bid Tabulations de7b-7dna $limit=15",
      buyer_or_entity: "Texas Department of Transportation",
      result_count: list.length,
      mode: "live",
      notes: res.ok
        ? "SODA JSON reachable"
        : `HTTP ${res.status} — dataset may require different resource id or be unavailable`,
      raw_summary: { http: res.status },
    });

    const portal = {
      seedId: "SOCRATA-TXDOT-PORTAL",
      section: "B. TEXAS — Open Data",
      url: "https://data.texas.gov/dataset/Bid-Tabulations/de7b-7dna",
      title: "TxDOT Bid Tabulations (Open Data portal)",
      buyerName: "Texas Department of Transportation",
      solicitationHints: { datasetId: "de7b-7dna" },
      roleHint: "REFERENCE_DATA",
      authorityHint: 2,
      downloadableHint: false,
    };
    await upsertCandidate(
      db,
      orgId,
      portal,
      { corpusRole: "REFERENCE_DATA", sourceAuthority: 2, reason: "Open data portal" },
      {
        status: list.length > 0 ? "LINK_ONLY" : "MANUAL_IMPORT",
        provider: "socrata",
        last_error: res.ok ? null : `HTTP ${res.status}`,
      },
    );

    // Persist a small JSON sidecar as local REFERENCE_DATA acquisition (not vault PDF)
    if (list.length > 0) {
      mkdirSync(DOWNLOAD_DIR, { recursive: true });
      const payload = Buffer.from(JSON.stringify(list, null, 2), "utf8");
      const sha = createHash("sha256").update(payload).digest("hex");
      const localPath = join(DOWNLOAD_DIR, `F23_TxDOT_bid_tabs_${sha.slice(0, 12)}.json`);
      writeFileSync(localPath, payload);
      const seed = {
        seedId: "SOCRATA-TXDOT-JSON",
        section: "B. TEXAS — Open Data",
        url: soda,
        title: "TxDOT Bid Tabulations SODA sample JSON",
        buyerName: "Texas Department of Transportation",
        solicitationHints: { datasetId: "de7b-7dna", rows: list.length },
        roleHint: "REFERENCE_DATA",
        authorityHint: 2,
        downloadableHint: true,
      };
      await upsertCandidate(
        db,
        orgId,
        seed,
        corpus.classifyCorpusRole({
          url: soda,
          title: seed.title,
          structuredReference: true,
        }),
        {
          status: "ACQUIRED",
          sha256: sha,
          local_path: localPath,
          byte_size: payload.length,
          content_type: "application/json",
          retrieved_at: new Date().toISOString(),
          provider: "socrata",
          package_key: "F23-REF-TXDOT-BIDTABS",
        },
      );
    }
    console.log(`Socrata TxDOT: HTTP ${res.status}, rows=${list.length}`);
    return { http: res.status, count: list.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logSaturation(db, orgId, {
      provider: "socrata",
      query: "TxDOT Bid Tabulations de7b-7dna",
      buyer_or_entity: "Texas Department of Transportation",
      result_count: null,
      mode: "live",
      notes: `FAILED: ${msg.slice(0, 200)}`,
    });
    return { http: 0, count: 0 };
  }
}

async function spotSearchLeads(db, orgId) {
  // Honest web spot-search: we do NOT scrape SERP with fabricated hits.
  // Record intended queries + any known public secondary URLs already in registry.
  const queries = [
    { entity: "Allen ISD", query: '"L&P Global Security" "Allen ISD" contract' },
    { entity: "Williamson County", query: '"L&P Global Security" "Williamson County" security' },
    { entity: "Mesquite ISD", query: '"L&P Global Security" "Mesquite ISD"' },
    { entity: "TxDMV", query: '"L&P Global Security" TxDMV TXMAS-24-99003' },
  ];
  for (const q of queries) {
    await logSaturation(db, orgId, {
      provider: "web_discovery",
      query: q.query,
      buyer_or_entity: q.entity,
      result_count: null,
      mode: "manual_lead",
      notes:
        "Spot-search lead logged only — no SERP scrape / no fabricated URLs. Prefer F23A primary seeds.",
    });
  }
  console.log(`Web discovery leads logged: ${queries.length} (no fabricated URLs)`);
}

function writeProviderRegistry() {
  const md = `# Source Provider Registry (F23)

| Provider | Plane | Capability | Live gate | Notes |
| --- | --- | --- | --- | --- |
| f23a_registry | Acquisition | Seed URLs | Always | Exact URLs from F23A registry — never invented |
| usa_spending | F3 research / F23 REFERENCE_DATA | AUTOMATED | Public API | spending_by_award; not fake packages |
| sam_gov | F2/F16 | AUTOMATED or MANUAL | \`SAM_GOV_API_KEY\` | Without key → MANUAL/LINK only |
| socrata | F16 | AUTOMATED | Domain + dataset | TxDOT bid tabs \`de7b-7dna\` attempted |
| texas_esbd | F16 | LINK_ONLY / MANUAL | Portal | No public solicitation API |
| tops / dps | Acquisition | LINK_ONLY + PDF seed | Public | Current license vs historical disciplinary |
| web_discovery | Authority 3 | Discovery lead | Manual | Never primary until official URL found |

## F9 hook (no second scheduler)

Idempotent CLI: \`npm run corpus:acquire\`. Optional future F9 cue: extend \`run_intelligence_automation\` with a non-mutating \`corpus_acquisition_backlog\` notification kind — **not** a new pg_cron job. Same rails as [F9_AUTOMATION_NOTIFICATIONS_ACCEPTANCE.md](../functionality/F9_AUTOMATION_NOTIFICATIONS_ACCEPTANCE.md).

## Trust

- Acquire path → \`AI_EXTRACTED\` only via F1 \`register_ingested_document\`
- Never \`HUMAN_VERIFIED\` from this path
- Authority 3 = discovery lead only
`;
  writeFileSync(PROVIDER_MD, md);
}

async function main() {
  mkdirSync(DOWNLOAD_DIR, { recursive: true });
  mkdirSync(PILOT_ACQUIRED, { recursive: true });

  const corpus = await bundleCorpus();
  const {
    parseRegistryText,
    classifyCorpusRole,
    fetchCandidate,
    ingestCandidateBytes,
    buildCoverageReport,
    coverageReportMarkdown,
    buildSaturationReport,
    saturationReportMarkdown,
    seedCandidatesFromParties,
  } = corpus;

  const adminClient = admin();
  const { orgId, userClient } = await resolveOrg(adminClient);
  const db = adminClient; // service role for candidate upserts
  const ingestClient = userClient ?? adminClient; // vault register needs org membership JWT

  console.log(`F23 acquire org=${orgId}`);

  if (!existsSync(REGISTRY)) {
    console.error("Missing registry:", REGISTRY);
    process.exit(1);
  }

  const registryText = readFileSync(REGISTRY, "utf8");
  const seeds = parseRegistryText(registryText);
  console.log(`Registry seeds parsed: ${seeds.length}`);

  // Prefer section C + downloadable; still seed all URLs as DISCOVERED/LINK
  const prioritized = [
    ...seeds.filter((s) => s.section.startsWith("C.")),
    ...seeds.filter((s) => !s.section.startsWith("C.")),
  ];

  const runLog = {
    started_at: new Date().toISOString(),
    org_id: orgId,
    acquired: [],
    ingested: [],
    duplicates: [],
    link_only: [],
    manual: [],
    failed: [],
    skipped_fetch: [],
  };

  for (const seed of prioritized) {
    const classified = classifyCorpusRole({
      url: seed.url,
      title: seed.title,
      buyerName: seed.buyerName,
      structuredReference: seed.roleHint === "REFERENCE_DATA",
    });
    // Prefer classifier; keep L_AND_P_DIRECT only when classifier agrees
    const role =
      seed.roleHint === "L_AND_P_DIRECT" && classified.corpusRole !== "L_AND_P_DIRECT"
        ? classified.corpusRole
        : classified.corpusRole;

    const linkOnly = preferLinkOnly(seed);
    console.log(`→ ${seed.seedId} ${linkOnly ? "[link]" : "[fetch]"} ${seed.url.slice(0, 90)}`);

    if (skipFetch || linkOnly) {
      const status = linkOnly ? "LINK_ONLY" : "DISCOVERED";
      await upsertCandidate(
        db,
        orgId,
        seed,
        { ...classified, corpusRole: role },
        { status, provider: "f23a_registry" },
      );
      if (linkOnly) runLog.link_only.push(seed.url);
      else runLog.skipped_fetch.push(seed.url);
      continue;
    }

    if (skipFetch) continue;

    const fetched = await fetchCandidate({
      url: seed.url,
      downloadDir: DOWNLOAD_DIR,
      filePrefix: seed.seedId,
      preferLinkOnly: false,
    });

    // Also copy PDF/DOCX into pilot/acquired for local cache (gitignored)
    if (fetched.ok && fetched.status === "ACQUIRED" && fetched.bytes && fetched.filename) {
      if (/\.(pdf|docx|xlsx|xls)$/i.test(fetched.filename)) {
        const pilotPath = join(PILOT_ACQUIRED, `F23_${fetched.filename}`);
        writeFileSync(pilotPath, fetched.bytes);
      }
    }

    if (!fetched.ok) {
      await upsertCandidate(
        db,
        orgId,
        seed,
        { ...classified, corpusRole: role },
        {
          status: fetched.status,
          last_error: fetched.error,
          content_type: fetched.contentType ?? null,
          retrieved_at: new Date().toISOString(),
        },
      );
      if (fetched.status === "MANUAL_IMPORT") runLog.manual.push({ url: seed.url, error: fetched.error });
      else if (fetched.status === "LINK_ONLY") runLog.link_only.push(seed.url);
      else runLog.failed.push({ url: seed.url, error: fetched.error });
      continue;
    }

    if (fetched.status === "LINK_ONLY") {
      await upsertCandidate(
        db,
        orgId,
        seed,
        { ...classified, corpusRole: role },
        {
          status: "LINK_ONLY",
          content_type: fetched.contentType,
          retrieved_at: new Date().toISOString(),
          last_error: fetched.note ?? null,
        },
      );
      runLog.link_only.push(seed.url);
      continue;
    }

    // ACQUIRED binary
    let documentId = null;
    let status = "ACQUIRED";
    const isVaultable =
      fetched.filename &&
      /\.(pdf|docx|xlsx|xls)$/i.test(fetched.filename) &&
      fetched.bytes &&
      !String(fetched.contentType ?? "").includes("json");

    if (!skipIngest && isVaultable) {
      const ingested = await ingestCandidateBytes(ingestClient, {
        organizationId: orgId,
        bytes: fetched.bytes,
        filename: fetched.filename,
        mimeType: fetched.contentType ?? "application/octet-stream",
        corpusRole: role,
        packageKey: packageKeyFor(seed),
        packageTitle: seed.title,
        batchLabel: "F23 corpus acquisition",
        createPackage: role !== "REFERENCE_DATA",
      });
      if (ingested.status === "INGESTED") {
        status = "INGESTED";
        documentId = ingested.documentId;
        runLog.ingested.push({ url: seed.url, sha256: ingested.sha256, documentId });
      } else if (ingested.status === "DUPLICATE") {
        status = "DUPLICATE";
        documentId = ingested.documentId;
        runLog.duplicates.push({ url: seed.url, sha256: ingested.sha256, documentId });
      } else {
        runLog.failed.push({ url: seed.url, error: ingested.error ?? "ingest failed" });
        await upsertCandidate(
          db,
          orgId,
          seed,
          { ...classified, corpusRole: role },
          {
            status: "ACQUIRED",
            sha256: fetched.sha256,
            local_path: fetched.localPath,
            byte_size: fetched.byteSize,
            content_type: fetched.contentType,
            retrieved_at: new Date().toISOString(),
            last_error: ingested.error ?? "ingest failed after acquire",
          },
        );
        runLog.acquired.push({ url: seed.url, sha256: fetched.sha256, path: fetched.localPath });
        continue;
      }
    } else {
      runLog.acquired.push({ url: seed.url, sha256: fetched.sha256, path: fetched.localPath });
    }

    await upsertCandidate(
      db,
      orgId,
      seed,
      { ...classified, corpusRole: role },
      {
        status,
        sha256: fetched.sha256,
        document_id: documentId,
        local_path: fetched.localPath,
        byte_size: fetched.byteSize,
        content_type: fetched.contentType,
        retrieved_at: new Date().toISOString(),
        package_key: packageKeyFor(seed),
      },
    );
  }

  // Party hunt stubs
  const { data: clients } = await db
    .from("clients")
    .select("id, name")
    .eq("organization_id", orgId)
    .limit(25);
  const { data: competitors } = await db
    .from("competitors")
    .select("id, name")
    .eq("organization_id", orgId)
    .limit(25);
  const parties = [
    ...(clients ?? []).map((c) => ({ id: c.id, name: c.name, kind: "buyer" })),
    ...(competitors ?? []).map((c) => ({ id: c.id, name: c.name, kind: "competitor" })),
  ];
  const partySeeds = seedCandidatesFromParties(orgId, parties);
  for (const p of partySeeds.slice(0, 20)) {
    const seed = {
      seedId: p.seedId,
      section: p.seedSection,
      url: p.url,
      title: p.title,
      buyerName: p.buyerName,
      solicitationHints: p.solicitationHints,
      roleHint: p.corpusRole,
      authorityHint: p.sourceAuthority,
      downloadableHint: false,
    };
    await upsertCandidate(
      db,
      orgId,
      seed,
      { corpusRole: p.corpusRole, sourceAuthority: p.sourceAuthority, reason: "party stub" },
      {
        status: "DISCOVERED",
        provider: p.provider,
        search_log: p.searchLog,
        package_key: null,
      },
    );
  }
  console.log(`Party hunt stubs: ${Math.min(partySeeds.length, 20)}`);

  await runUsaSpending(db, orgId, corpus);
  await runSam(db, orgId, corpus);
  await runSocrataTxdot(db, orgId, corpus);
  await spotSearchLeads(db, orgId);

  const { data: allCandidates } = await db
    .from("acquisition_candidates")
    .select(
      "id, url, title, corpus_role, source_authority, status, sha256, document_id, package_key, buyer_name, seed_section, last_error",
    )
    .eq("organization_id", orgId);

  const { data: satRuns } = await db
    .from("acquisition_saturation_runs")
    .select("provider, query, buyer_or_entity, result_count, mode, notes, attempted_at")
    .eq("organization_id", orgId)
    .order("attempted_at", { ascending: false })
    .limit(200);

  const coverage = buildCoverageReport(allCandidates ?? []);
  const saturation = buildSaturationReport(satRuns ?? []);
  writeFileSync(COVERAGE_MD, coverageReportMarkdown(coverage));
  writeFileSync(SATURATION_MD, saturationReportMarkdown(saturation));
  writeProviderRegistry();

  runLog.finished_at = new Date().toISOString();
  runLog.coverage_totals = coverage.totals;

  const md = [
    "# Acquisition Run (F23)",
    "",
    `Started: ${runLog.started_at}`,
    `Finished: ${runLog.finished_at}`,
    `Organization: \`${orgId}\``,
    "",
    "## Summary",
    "",
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Registry seeds | ${seeds.length} |`,
    `| Candidates in DB | ${coverage.totals.candidates} |`,
    `| Vault ingested | ${runLog.ingested.length} |`,
    `| Duplicates | ${runLog.duplicates.length} |`,
    `| Acquired (local/ref) | ${runLog.acquired.length} |`,
    `| Link-only | ${runLog.link_only.length} |`,
    `| Manual | ${runLog.manual.length} |`,
    `| Failed | ${runLog.failed.length} |`,
    "",
    "## Exact URLs acquired / ingested",
    "",
    ...[...runLog.ingested, ...runLog.duplicates, ...runLog.acquired].map(
      (r) => `- ${r.url}${r.sha256 ? ` (sha256=${r.sha256.slice(0, 12)}…)` : ""}`,
    ),
    "",
    "## Exact URLs link-only",
    "",
    ...runLog.link_only.map((u) => `- ${u}`),
    "",
    "## Exact URLs manual",
    "",
    ...runLog.manual.map((r) => `- ${r.url} — ${r.error}`),
    "",
    "## Exact URLs failed",
    "",
    ...runLog.failed.map((r) => `- ${r.url} — ${r.error}`),
    "",
    "## Trust",
    "",
    "- No \`HUMAN_VERIFIED\` from this path",
    "- Binaries under \`docs/corpus/downloads/\` and \`docs/pilot/acquired/\` are **gitignored**",
    "- USAspending / SAM / Socrata results are REFERENCE_DATA or LINK_ONLY — not fabricated packages",
    "",
  ].join("\n");

  writeFileSync(RUN_MD, md);
  writeFileSync(join(ROOT, "docs/benchmarks/f23-acquisition-run.json"), JSON.stringify(runLog, null, 2));

  console.log("\n=== F23 acquire complete ===");
  console.log(JSON.stringify(coverage.totals, null, 2));
  console.log("Wrote", RUN_MD);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
