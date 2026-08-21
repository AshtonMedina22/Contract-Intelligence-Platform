#!/usr/bin/env node
// P9 acceptance: the Intelligence workbench — one Ask launch surface, one recompete radar that
// never borrows L&P's own renewals, and no number that outruns its evidence.
//
// The invariants under test:
//   * there is exactly ONE way an Intelligence view reaches Ask (`buildAskHref`), one Ask page and
//     one Ask backend — no view mounts a second chat client or a second research provider;
//   * no view states or implies market share, and every count carries its own sample size;
//   * Market radar and the L&P-held renewal queue are separate lists with separate labels, and a
//     contract L&P holds can never appear as a market recompete;
//   * "expected rebid" restates a verified date and names the field it came from — it is never a
//     forecast, and a row with no date says unknown;
//   * a win rate is withheld until the decided sample can carry it, and a table filter can never
//     change the denominator;
//   * the four commercial pricing truths stay in four columns;
//   * `/intelligence/buyers` is no longer a dead link anywhere.
//
// Runs with no network and no database. The real TypeScript modules are bundled with esbuild so the
// test exercises shipped code; UI wiring is asserted by grep.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const webRoot = path.join(root, "apps/web");
const outdir = await fs.mkdtemp(path.join(os.tmpdir(), "lp-p9-"));

async function bundle(relEntry, name) {
  const outfile = path.join(outdir, name);
  await esbuild.build({
    entryPoints: [path.join(webRoot, relEntry)],
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

const askLaunch = await bundle("lib/intelligence/ask-launch.ts", "ask-launch.mjs");
const radarModule = await bundle("lib/intelligence/recompete-radar.ts", "recompete-radar.mjs");
const observations = await bundle("lib/intelligence/observations.ts", "observations.mjs");
const purposeModule = await bundle("lib/retrieval/purpose.ts", "purpose.mjs");
const reportsModule = await bundle("lib/reports/generate.ts", "reports.mjs");

const {
  ASK_CHIP_PURPOSE,
  ASK_LAUNCH_NOTE,
  ASK_LAUNCH_PATH,
  ASK_LAUNCH_VIEWS,
  askChip,
  askLaunchViewFromParam,
  buildAskHref,
  parseAskContext,
  serializeAskContext,
} = askLaunch;

const {
  LP_RENEWALS_LABEL,
  LP_RENEWALS_ROUTE,
  MARKET_RADAR_LABEL,
  MARKET_RADAR_SCOPE_NOTE,
  RADAR_DATA_STATUS_LABELS,
  RADAR_HOLDER_LABELS,
  RADAR_NO_PREDICTION_NOTE,
  buildRecompeteRadar,
  filterRadarRows,
  isLandPName,
} = radarModule;

const {
  DECIDED_OUTCOMES,
  HONESTY_STRIP_TEXT,
  MIN_WIN_RATE_SAMPLE,
  UNDECIDED_OUTCOMES,
  WIN_RATE_DEFINITION,
  observationTile,
  observedSpan,
  summarizeWinLoss,
} = observations;

const { RETRIEVAL_PURPOSES } = purposeModule;
const { REPORT_CATALOG } = reportsModule;

// Read with LF endings so the regexes below behave the same on Windows checkouts.
const readSource = async (...segments) =>
  (await fs.readFile(path.join(...segments), "utf8")).replace(/\r\n/g, "\n");

const view = (slug) =>
  readSource(webRoot, "app/(platform)/intelligence", slug, "page.tsx");

const sources = {
  market: await view("market"),
  clients: await view("clients"),
  competitors: await view("competitors"),
  pricing: await view("pricing"),
  winLoss: await view("win-loss"),
  content: await view("content"),
  reports: await view("reports"),
  ask: await view("ask"),
  buyersRedirect: await view("buyers"),
  radarTable: await readSource(
    webRoot,
    "app/(platform)/intelligence/market/recompete-radar-table.tsx",
  ),
  buyerTable: await readSource(
    webRoot,
    "app/(platform)/intelligence/clients/buyers-portfolio-table.tsx",
  ),
  competitorTable: await readSource(
    webRoot,
    "app/(platform)/intelligence/competitors/competitors-table.tsx",
  ),
  pricingTable: await readSource(
    webRoot,
    "app/(platform)/intelligence/pricing/pricing-lines-table.tsx",
  ),
  competitorRatesTable: await readSource(
    webRoot,
    "app/(platform)/intelligence/pricing/competitor-lines-table.tsx",
  ),
  winLossTable: await readSource(
    webRoot,
    "app/(platform)/intelligence/win-loss/win-loss-table.tsx",
  ),
  honestyStrip: await readSource(webRoot, "components/intelligence/honesty-strip.tsx"),
  sectionTabs: await readSource(webRoot, "components/section-tabs.tsx"),
  registry: await readSource(webRoot, "lib/data-model/registry.ts"),
  homeSnapshot: await readSource(webRoot, "components/home/market-snapshot.tsx"),
  askLaunchLib: await readSource(webRoot, "lib/intelligence/ask-launch.ts"),
  radarLib: await readSource(webRoot, "lib/intelligence/recompete-radar.ts"),
  observationsLib: await readSource(webRoot, "lib/intelligence/observations.ts"),
  loadCorpus: await readSource(webRoot, "lib/intelligence/load-corpus.ts"),
};

/** The seven secondary views the workbench is made of. `ask` is the header capability, not a view. */
const VIEW_SLUGS = ["market", "clients", "competitors", "pricing", "win-loss", "content", "reports"];
const VIEW_SOURCES = {
  market: sources.market,
  clients: sources.clients,
  competitors: sources.competitors,
  pricing: sources.pricing,
  "win-loss": sources.winLoss,
  content: sources.content,
  reports: sources.reports,
};

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, message: err instanceof Error ? err.message : String(err) });
  }
}

// ------------------------------------------------------------------ ask-launch

check("buildAskHref emits a stable, ordered, encoded href into the one Ask surface", () => {
  const href = buildAskHref({
    mode: "ask",
    purpose: "LOSS_ANALYSIS",
    q: "why did we lose Arlington?",
    opportunityId: "opp-1",
    from: "win-loss",
    filters: { won: 2, lost: 5 },
  });
  assert.ok(href.startsWith(`${ASK_LAUNCH_PATH}?`), `href must target ${ASK_LAUNCH_PATH}`);
  const url = new URL(href, "https://example.test");
  assert.equal(url.pathname, ASK_LAUNCH_PATH);
  assert.deepEqual([...url.searchParams.keys()], ["mode", "purpose", "q", "opportunity", "from", "context"]);
  assert.equal(url.searchParams.get("q"), "why did we lose Arlington?");
  assert.ok(href.includes("why+did+we+lose+Arlington%3F"), "the query must be encoded");
  // Same input, same href — the acceptance test and the browser URL cannot drift.
  assert.equal(
    href,
    buildAskHref({
      mode: "ask",
      purpose: "LOSS_ANALYSIS",
      q: "why did we lose Arlington?",
      opportunityId: "opp-1",
      from: "win-loss",
      filters: { lost: 5, won: 2 },
    }),
    "filter key order must not change the href",
  );
});

check("an unknown or absent purpose falls back to the mode default, never travels raw", () => {
  for (const [mode, expected] of [
    ["locate", "LOCATE"],
    ["report", "REPORT_GENERATION"],
    ["ask", "GENERAL_QA"],
  ]) {
    assert.equal(
      new URL(buildAskHref({ mode }), "https://x.test").searchParams.get("purpose"),
      expected,
    );
    assert.equal(
      new URL(buildAskHref({ mode, purpose: "MAKE_IT_UP" }), "https://x.test").searchParams.get("purpose"),
      expected,
      "a bogus purpose must not reach the Ask page",
    );
  }
  const lowercase = new URL(buildAskHref({ mode: "ask", purpose: "pricing_analysis" }), "https://x.test");
  assert.equal(lowercase.searchParams.get("purpose"), "PRICING_ANALYSIS");
});

check("blank and absent values are omitted rather than sent as empty params", () => {
  const href = buildAskHref({
    mode: "locate",
    q: "   ",
    opportunityId: "",
    report: null,
    filters: { empty: "", nothing: null, undef: undefined, kept: "yes" },
  });
  const url = new URL(href, "https://x.test");
  assert.deepEqual([...url.searchParams.keys()], ["mode", "purpose", "context"]);
  assert.equal(url.searchParams.get("context"), "kept=yes");
  const bare = new URL(buildAskHref({ mode: "locate", filters: {} }), "https://x.test");
  assert.deepEqual([...bare.searchParams.keys()], ["mode", "purpose"]);
});

check("view context round-trips and is documented as provenance only", () => {
  const context = serializeAskContext({ service: "Armed guard", geography: "TX", rows: 3 });
  assert.equal(context, "geography=TX; rows=3; service=Armed guard");
  assert.deepEqual(parseAskContext(context), [
    { key: "geography", value: "TX" },
    { key: "rows", value: "3" },
    { key: "service", value: "Armed guard" },
  ]);
  assert.equal(serializeAskContext(null), null);
  assert.equal(serializeAskContext({}), null);
  assert.deepEqual(parseAskContext(null), []);
  assert.match(ASK_LAUNCH_NOTE, /no second chatbot and no second research engine/);
  assert.match(ASK_LAUNCH_NOTE, /do not narrow retrieval/);
});

check("every view has a registered slug and a purpose from the real purpose union", () => {
  assert.deepEqual(Object.keys(ASK_LAUNCH_VIEWS).sort(), [...VIEW_SLUGS].sort());
  for (const slug of VIEW_SLUGS) {
    assert.ok(askLaunchViewFromParam(slug), `${slug} must be a recognised launch view`);
    assert.ok(
      RETRIEVAL_PURPOSES.includes(ASK_CHIP_PURPOSE[slug]),
      `${slug} maps to a purpose that does not exist`,
    );
  }
  assert.equal(askLaunchViewFromParam("../../etc"), null);
  assert.equal(askLaunchViewFromParam(""), null);
  // An inherited Object key is not a view. `in` would accept these and hand the banner a function
  // to render, so the guard has to be an own-property check.
  for (const inherited of ["toString", "constructor", "__proto__", "hasOwnProperty", "valueOf"]) {
    assert.equal(askLaunchViewFromParam(inherited), null, `${inherited} must not be a launch view`);
  }
  // Case is part of the slug: a chip cannot reflect arbitrary casing into the banner label.
  assert.equal(askLaunchViewFromParam("Competitors"), null);
  assert.equal(askLaunchViewFromParam("WIN-LOSS"), null);
});

check("the required per-view Ask purposes are the ones the brief names", () => {
  assert.equal(ASK_CHIP_PURPOSE.competitors, "COMPETITOR_ANALYSIS");
  assert.equal(ASK_CHIP_PURPOSE.pricing, "PRICING_ANALYSIS");
  assert.equal(ASK_CHIP_PURPOSE["win-loss"], "LOSS_ANALYSIS");
  assert.equal(ASK_CHIP_PURPOSE.content, "LOCATE");
  // A chip with no explicit purpose inherits its view's purpose rather than a generic default.
  assert.match(askChip({ label: "x", mode: "ask", from: "win-loss" }).href, /purpose=LOSS_ANALYSIS/);
  assert.match(askChip({ label: "x", mode: "ask", from: "pricing" }).href, /purpose=PRICING_ANALYSIS/);
  const chip = askChip({ label: "Competitor analysis", mode: "ask", from: "competitors" });
  assert.match(chip.title, /purpose=COMPETITOR_ANALYSIS/);
  assert.match(chip.title, /evidence-only/);
});

check("each view actually launches Ask through the shared builder with its own purpose", () => {
  for (const slug of VIEW_SLUGS) {
    const src = VIEW_SOURCES[slug];
    assert.match(src, /from "@\/lib\/intelligence\/ask-launch"/, `${slug} does not import ask-launch`);
    assert.match(src, /askChip\(|buildAskHref\(/, `${slug} builds no Ask href`);
    assert.match(src, new RegExp(`from: "${slug}"`), `${slug} does not tag its chips with its view`);
    assert.match(src, /AskAboutThis/, `${slug} renders no Ask chips`);
  }
  assert.match(sources.content, /purpose: "PROPOSAL_DRAFTING"/, "Content must offer a drafting chip");
  assert.match(sources.buyerTable, /purpose: "GENERAL_QA"/, "the buyer brief chip must be GENERAL_QA");
  assert.match(sources.buyerTable, /report: "buyer"/);
});

check("no Intelligence view builds an Ask URL by hand", () => {
  for (const [slug, src] of Object.entries(VIEW_SOURCES)) {
    const handmade = src.match(/["'`]\/intelligence\/ask\?[^"'`]*/g) ?? [];
    assert.deepEqual(handmade, [], `${slug} hand-writes an Ask query string: ${handmade.join(", ")}`);
  }
});

check("there is one Ask backend: no view mounts a chat client or a research provider", () => {
  for (const [slug, src] of Object.entries(VIEW_SOURCES)) {
    assert.ok(!/AskChatClient|ask-chat/.test(src), `${slug} must not mount a second chat client`);
    assert.ok(
      !/streamText|generateText|generateObject|streamAskChat/.test(src),
      `${slug} must not call a model directly`,
    );
    assert.ok(
      !/lib\/ask\/research|researchProvider|\btavily\b|\bexa\.ai\b|\bserper\b|\bperplexity\b/i.test(src),
      `${slug} must not reach a second research engine`,
    );
  }
  // The dual-rail agent stays exactly where it was: on the Ask page, behind mode=ask.
  assert.match(sources.ask, /from "@\/components\/ask\/ask-chat"/);
  assert.match(sources.ask, /mode === "ask"/);
  assert.match(sources.ask, /AskChatClient/);
  assert.equal((sources.ask.match(/<AskChatClient/g) ?? []).length, 1);
});

check("the Ask page honours an incoming mode, purpose and query and shows a context banner", () => {
  assert.match(sources.ask, /purposeFromParam\(params\.purpose\) \?\? defaultPurposeForMode\(mode\)/);
  assert.match(sources.ask, /const query = params\.q\?\.trim\(\)/);
  assert.match(sources.ask, /askLaunchViewFromParam\(params\.from\)/);
  assert.match(sources.ask, /parseAskContext\(params\.context\)/);
  assert.match(sources.ask, /data-testid="ask-context-banner"/);
  assert.match(sources.ask, /Launched from/);
  assert.match(sources.ask, /did not narrow retrieval/);
  // The banner survives a resubmit of the mode form.
  assert.match(sources.ask, /<input type="hidden" name="from"/);
  assert.match(sources.ask, /<input type="hidden" name="context"/);
  // LOCATE and REPORT paths are untouched.
  assert.match(sources.ask, /mode === "locate"/);
  assert.match(sources.ask, /locateRecords/);
  assert.match(sources.ask, /No LLM used/);
  assert.match(sources.ask, /generateIntelligenceReport/);
});

// ------------------------------------------------------- no market share, ever

check("no market-share claim survives anywhere in the workbench", () => {
  const all = {
    ...VIEW_SOURCES,
    ask: sources.ask,
    "honesty-strip": sources.honestyStrip,
    "radar-table": sources.radarTable,
    "ask-launch": sources.askLaunchLib,
    radar: sources.radarLib,
    observations: sources.observationsLib,
  };
  for (const [name, src] of Object.entries(all)) {
    for (const match of src.matchAll(/market\s+(share|size)/gi)) {
      const before = src.slice(Math.max(0, match.index - 48), match.index);
      assert.match(
        before,
        /\b(not|never|no|nothing|neither|without|invents?|implies)\b[^.]*$/i,
        `${name} mentions "${match[0]}" without negating it: …${before}${match[0]}`,
      );
    }
    assert.ok(
      !/share of (the )?market|% of market|market penetration|TAM\b/i.test(src),
      `${name} states a share of a market`,
    );
  }
});

check("the shared honesty strip says what it must and every view renders it", () => {
  assert.match(HONESTY_STRIP_TEXT, /Verified observations only; not market share/);
  assert.match(HONESTY_STRIP_TEXT, /sample size stated/);
  assert.match(HONESTY_STRIP_TEXT, /Nothing here is a forecast/);
  assert.match(sources.honestyStrip, /HONESTY_STRIP_TEXT/);
  assert.match(sources.honestyStrip, /data-testid="intelligence-honesty-strip"/);
  for (const [slug, src] of Object.entries(VIEW_SOURCES)) {
    assert.match(src, /<IntelligenceHonestyStrip/, `${slug} does not render the honesty strip`);
  }
});

check("every view has a dense PageHeader from the shell, not a hand-rolled h1", () => {
  for (const [slug, src] of Object.entries(VIEW_SOURCES)) {
    assert.match(src, /from "@\/components\/shell"/, `${slug} does not use the shell`);
    assert.match(src, /<PageHeader/, `${slug} has no PageHeader`);
    assert.ok(
      !/<h1 /.test(src),
      `${slug} still hand-rolls an h1 instead of using PageHeader`,
    );
  }
});

check("the secondary tabs stay tabs — no Intelligence app is promoted to the sidebar", () => {
  assert.match(sources.sectionTabs, /export function IntelligenceNav/);
  assert.match(sources.sectionTabs, /<SectionTabs tabs=\{INTELLIGENCE_TABS\} \/>/);
  const tabs = [...sources.sectionTabs.matchAll(/\{ href: "\/intelligence\/([a-z-]+)", label:/g)].map(
    (m) => m[1],
  );
  assert.deepEqual(tabs.sort(), [...VIEW_SLUGS].sort(), "the tab set must be exactly the seven views");
  assert.ok(!/\/intelligence\/ask/.test(sources.sectionTabs), "Ask is a header capability, not a tab");
  for (const [slug, src] of Object.entries(VIEW_SOURCES)) {
    assert.match(src, /<IntelligenceNav \/>/, `${slug} must render the secondary tabs`);
  }
});

check("every tile carries its own sample count and its source table", () => {
  const tile = observationTile({ label: "Verified awards", value: 7, source: "awards", unit: "awards" });
  assert.equal(tile.sample, "n=7 awards");
  assert.equal(tile.basis, "OBSERVED");
  assert.equal(observationTile({ label: "x", value: null, source: "t" }).sample, "n=0 records");
  assert.equal(observationTile({ label: "x", value: Number.NaN, source: "t" }).value, 0);
  assert.equal(
    observationTile({ label: "x", value: 3, source: "t", basis: "INFERENCE" }).basis,
    "INFERENCE",
  );
  assert.match(sources.honestyStrip, /\{tile\.sample\}/);
  assert.match(sources.honestyStrip, /EvidenceBasisBadge/);
  for (const slug of ["market", "clients", "competitors", "pricing", "win-loss", "content"]) {
    assert.match(VIEW_SOURCES[slug], /observationTile\(/, `${slug} does not build sampled tiles`);
    assert.match(VIEW_SOURCES[slug], /<ObservationTiles/, `${slug} does not render the tiles`);
  }
});

check("observed spans state n and never invent a typical rate", () => {
  assert.deepEqual(observedSpan([31, 42, null, Number.NaN, 18]), { count: 3, min: 18, max: 42 });
  assert.equal(observedSpan([]), null);
  assert.equal(observedSpan([null, undefined]), null);
  assert.match(sources.pricing, /observedSpan\(/);
  assert.match(sources.pricing, /n=\$\{span\.count\}/);
  assert.ok(
    !/typical rate|recommended rate|market rate|benchmark rate/i.test(sources.pricing) ||
      /not a recommended rate, a market rate, or a benchmark/.test(sources.pricing),
    "a span must not read as a recommendation",
  );
});

// -------------------------------------------------------- recompete radar model

const BUYERS = [
  { id: "b-arlington", name: "City of Arlington TX" },
  { id: "b-dallas", name: "Dallas ISD" },
  { id: "b-plano", name: "City of Plano" },
];

const OPPORTUNITIES = [
  {
    id: "o-arlington",
    client_id: "b-arlington",
    title: "Arlington armed guard services",
    service_type: "Armed guard",
    site_location: "Arlington, TX",
    source_url: "https://arlington.example/bid-2026",
  },
  {
    id: "o-dallas",
    client_id: "b-dallas",
    title: "Dallas ISD campus security",
    service_type: "Unarmed guard",
    site_location: "Dallas, TX",
    source_url: null,
  },
  {
    id: "o-plano",
    client_id: "b-plano",
    title: "Plano patrol services",
    service_type: "Armed guard",
    site_location: "Plano, TX",
    source_url: null,
  },
];

function radarFixture(overrides = {}) {
  return buildRecompeteRadar({
    buyers: BUYERS,
    opportunities: OPPORTUNITIES,
    awards: [
      {
        id: "a-arlington",
        opportunity_id: "o-arlington",
        winner_name: "Securitas Security Services USA",
        awarded_on: "2024-08-01",
        notice: "Minute Order 24-118",
        source_fact_id: "f-arlington",
        source_document_id: "d-arlington-notice",
      },
      {
        id: "a-plano",
        opportunity_id: "o-plano",
        winner_name: "L&P Global Security",
        awarded_on: "2025-01-15",
        notice: "Award notice",
        source_fact_id: "f-plano",
        source_document_id: null,
      },
    ],
    contracts: [
      {
        id: "c-dallas",
        client_id: "b-dallas",
        opportunity_id: "o-dallas",
        title: "Dallas ISD security contract",
        contract_number: "DISD-2025-114",
        start_on: "2025-07-01",
        verified_end_on: "2027-06-30",
        source_fact_id: "f-dallas",
        source_document_id: "d-dallas-contract",
      },
    ],
    contractOptions: [
      { id: "opt-1", contract_id: "c-dallas", label: "Option year 1", exercise_by: "2027-03-31", source_fact_id: "f-opt" },
    ],
    renewalNotices: [],
    winLoss: [
      { opportunity_id: "o-arlington", outcome: "LOST", winner_name: "Securitas Security Services USA" },
    ],
    ...overrides,
  });
}

check("a contract L&P holds is never a market recompete row", () => {
  const radar = radarFixture();
  const marketKeys = radar.market.map((r) => r.key);
  const lpKeys = radar.lpHeld.map((r) => r.key);
  assert.ok(!marketKeys.includes("contract:c-dallas"), "an L&P contract leaked into the market radar");
  assert.ok(lpKeys.includes("contract:c-dallas"));
  assert.deepEqual(
    marketKeys.filter((k) => lpKeys.includes(k)),
    [],
    "the two lists must be disjoint",
  );
  assert.equal(radar.counts.market + radar.counts.lpHeld, marketKeys.length + lpKeys.length);
  // An award naming L&P is L&P-held even with no contract row of ours.
  assert.ok(lpKeys.includes("opportunity:o-plano"));
  assert.ok(isLandPName("L&P Global Security"));
  assert.ok(isLandPName("L and P Global"));
  assert.ok(!isLandPName("Securitas Security Services USA"));
  assert.ok(!isLandPName(null));
});

check("an incumbent is only named when a record names it, and the basis is stated", () => {
  const radar = radarFixture();
  const arlington = radar.market.find((r) => r.key === "opportunity:o-arlington");
  assert.ok(arlington, "the Arlington recompete is missing");
  assert.equal(arlington.holder, "COMPETITOR");
  assert.equal(arlington.incumbent.name, "Securitas Security Services USA");
  assert.match(arlington.incumbent.basis, /awards\.winner_name/);
  assert.equal(arlington.buyerName, "City of Arlington TX");

  const anonymous = buildRecompeteRadar({
    buyers: BUYERS,
    opportunities: OPPORTUNITIES,
    awards: [
      {
        id: "a-x",
        opportunity_id: "o-arlington",
        winner_name: null,
        awarded_on: null,
        notice: null,
        source_fact_id: null,
        source_document_id: null,
      },
    ],
  });
  const row = anonymous.market[0];
  assert.equal(row.incumbent, null, "an award with no winner must not produce an incumbent");
  assert.equal(row.holder, "UNKNOWN");
  assert.ok(row.missing.includes("incumbent"));
  assert.match(RADAR_HOLDER_LABELS.UNKNOWN, /not recorded/);
});

check("a win/loss record can name the incumbent when the award row does not", () => {
  const radar = buildRecompeteRadar({
    buyers: BUYERS,
    opportunities: OPPORTUNITIES,
    awards: [
      {
        id: "a-x",
        opportunity_id: "o-arlington",
        winner_name: null,
        awarded_on: null,
        notice: null,
        source_fact_id: null,
        source_document_id: null,
      },
    ],
    winLoss: [{ opportunity_id: "o-arlington", outcome: "LOST", winner_name: "Allied Universal" }],
  });
  const row = radar.market[0];
  assert.equal(row.incumbent.name, "Allied Universal");
  assert.match(row.incumbent.basis, /win_loss_reviews\.winner_name/);
  assert.equal(row.holder, "COMPETITOR");
});

check("expected rebid restates a verified date and names the field — never a forecast", () => {
  const lp = radarFixture().lpHeld.find((r) => r.key === "contract:c-dallas");
  assert.equal(lp.expirationOn, "2027-06-30");
  assert.equal(lp.expectedRebid.on, "2027-06-30");
  assert.match(lp.expectedRebid.basis, /contracts\.verified_end_on/);
  assert.deepEqual(lp.options, [{ label: "Option year 1", exerciseBy: "2027-03-31" }]);
  assert.equal(lp.nextOptionExerciseBy, "2027-03-31");

  // No end date: the earliest option / notice date is used, and said so.
  const optionOnly = buildRecompeteRadar({
    buyers: BUYERS,
    opportunities: OPPORTUNITIES,
    contracts: [
      {
        id: "c-2",
        client_id: "b-dallas",
        opportunity_id: null,
        title: "No end date",
        contract_number: null,
        start_on: null,
        verified_end_on: null,
        source_fact_id: null,
        source_document_id: null,
      },
    ],
    contractOptions: [
      { id: "o1", contract_id: "c-2", label: "OY2", exercise_by: "2028-01-01", source_fact_id: null },
      { id: "o2", contract_id: "c-2", label: "OY1", exercise_by: "2026-01-01", source_fact_id: null },
    ],
    renewalNotices: [
      { id: "n1", contract_id: "c-2", notice_due_on: "2027-01-01", option_year: 2, source_fact_id: null },
    ],
  }).lpHeld[0];
  assert.equal(optionOnly.expectedRebid.on, "2026-01-01", "the earliest verified date wins");
  assert.match(optionOnly.expectedRebid.basis, /exercise_by \/ renewals\.notice_due_on/);

  // Nothing on file: the row says unknown instead of guessing from the award date.
  const unknown = radarFixture().market.find((r) => r.key === "opportunity:o-arlington");
  assert.equal(unknown.expectedRebid.on, null);
  assert.match(unknown.expectedRebid.basis, /No verified end date/);
  assert.ok(unknown.missing.includes("verified expiration"));
  assert.match(RADAR_NO_PREDICTION_NOTE, /never inferred from a term length/);
});

check("data status is earned: verified needs incumbent, expiration and a source together", () => {
  const full = buildRecompeteRadar({
    buyers: BUYERS,
    opportunities: OPPORTUNITIES,
    awards: [
      {
        id: "a",
        opportunity_id: "o-arlington",
        winner_name: "Securitas",
        awarded_on: "2024-01-01",
        notice: null,
        source_fact_id: null,
        source_document_id: "d-1",
      },
    ],
    // A competitor-held contract row cannot exist in our tenant, so verified market rows need the
    // expiration to arrive with the award document. This fixture supplies both.
    contracts: [],
  });
  const partial = full.market[0];
  assert.equal(partial.dataStatus, "PARTIAL");
  assert.ok(partial.missing.includes("verified expiration"));

  const bare = buildRecompeteRadar({
    buyers: BUYERS,
    opportunities: OPPORTUNITIES,
    awards: [
      {
        id: "a",
        opportunity_id: "o-dallas",
        winner_name: null,
        awarded_on: null,
        notice: null,
        source_fact_id: null,
        source_document_id: null,
      },
    ],
  }).market[0];
  assert.equal(bare.dataStatus, "UNKNOWN");
  assert.deepEqual(bare.missing, ["incumbent", "verified expiration", "options", "source"]);

  const verified = radarFixture().lpHeld.find((r) => r.key === "contract:c-dallas");
  assert.equal(verified.dataStatus, "PARTIAL", "no incumbent recorded yet, so not verified");
  for (const status of ["VERIFIED", "PARTIAL", "UNKNOWN"]) {
    assert.ok(RADAR_DATA_STATUS_LABELS[status], `${status} has no operator label`);
  }
});

check("a source is a link to the record, or the row says there is none", () => {
  const arlington = radarFixture().market.find((r) => r.key === "opportunity:o-arlington");
  assert.ok(
    arlington.sources.some((s) => s.href === "/ingestion/verification/d-arlington-notice"),
    "an award document must link to verification",
  );
  assert.ok(arlington.sources.some((s) => s.href === "https://arlington.example/bid-2026"));
  const plano = radarFixture().lpHeld.find((r) => r.key === "opportunity:o-plano");
  assert.ok(
    plano.sources.some((s) => /^award fact/.test(s.label) && s.href === null),
    "a fact-only source must not pretend to be a link",
  );
  assert.match(sources.radarTable, /no source recorded|Absent what="source record"/);
  assert.match(sources.radarTable, /RADAR_DATA_STATUS_LABELS/);
  assert.match(sources.radarTable, /missing: \$\{row\.missing\.join/);
});

check("facets only offer values the corpus actually has", () => {
  const radar = radarFixture();
  assert.deepEqual(radar.facets.services, ["Armed guard"]);
  assert.deepEqual(radar.facets.geographies, ["Arlington, TX"]);
  assert.ok(
    !radar.facets.geographies.includes("Dallas, TX"),
    "an L&P-held row must not seed a market facet",
  );
});

check("filters match only on present fields and never assume a missing date", () => {
  const rows = radarFixture().market;
  assert.equal(filterRadarRows(rows, { service: "armed guard" }).length, 1);
  assert.equal(filterRadarRows(rows, { service: "Janitorial" }).length, 0);
  assert.equal(filterRadarRows(rows, { geography: "arlington, tx" }).length, 1);
  assert.equal(
    filterRadarRows(rows, { from: "2020-01-01" }).length,
    0,
    "a row with no expected rebid date must drop out of a date filter, not pass it",
  );
  assert.deepEqual(filterRadarRows(rows, {}), rows);

  const dated = radarFixture().lpHeld;
  assert.equal(filterRadarRows(dated, { from: "2027-01-01", to: "2027-12-31" }).length, 1);
  assert.equal(filterRadarRows(dated, { from: "2028-01-01" }).length, 0);
  assert.equal(filterRadarRows(dated, { to: "2026-12-31" }).length, 0);
});

check("radar rows sort by the soonest known date, unknowns last", () => {
  const radar = buildRecompeteRadar({
    buyers: BUYERS,
    opportunities: OPPORTUNITIES,
    contracts: [
      {
        id: "c-late",
        client_id: "b-dallas",
        opportunity_id: null,
        title: "Late",
        contract_number: null,
        start_on: null,
        verified_end_on: "2029-01-01",
        source_fact_id: null,
        source_document_id: null,
      },
      {
        id: "c-soon",
        client_id: "b-dallas",
        opportunity_id: null,
        title: "Soon",
        contract_number: null,
        start_on: null,
        verified_end_on: "2026-01-01",
        source_fact_id: null,
        source_document_id: null,
      },
      {
        id: "c-none",
        client_id: "b-dallas",
        opportunity_id: null,
        title: "Undated",
        contract_number: null,
        start_on: null,
        verified_end_on: null,
        source_fact_id: null,
        source_document_id: null,
      },
    ],
  });
  assert.deepEqual(
    radar.lpHeld.map((r) => r.contractLabel),
    ["Soon", "Late", "Undated"],
  );
});

// ------------------------------------------- market radar vs L&P renewals in UI

check("the Market view labels the two lists separately and links the renewal queue", () => {
  assert.match(MARKET_RADAR_LABEL, /Market radar/);
  assert.match(LP_RENEWALS_LABEL, /L&P-held renewals/);
  assert.equal(LP_RENEWALS_ROUTE, "/contracts/renewals");
  assert.match(MARKET_RADAR_SCOPE_NOTE, /contracts L&P does not hold/);
  assert.match(sources.market, /MARKET_RADAR_LABEL/);
  assert.match(sources.market, /LP_RENEWALS_LABEL/);
  assert.match(sources.market, /LP_RENEWALS_ROUTE/);
  assert.match(sources.market, /data-testid="recompete-radar"/);
  assert.match(sources.market, /data-testid="lp-held-renewals"/);
  assert.match(sources.market, /excluded from the market radar above/);
  // The radar table is fed the market list only.
  assert.match(sources.market, /<RecompeteRadarTable rows=\{filtered\} \/>/);
  assert.match(sources.market, /filterRadarRows\(radar\.market, filters\)/);
  assert.ok(
    !/<RecompeteRadarTable rows=\{radar\.lpHeld/.test(sources.market),
    "the radar table must never render L&P-held rows",
  );
});

check("the Market view keeps its Phase 5 evidence sources and adds no document count", () => {
  for (const table of ["awards", "win_loss_reviews", "competitor_bids", "pricing_lines"]) {
    assert.match(sources.market, new RegExp(`from\\("${table}"\\)`), `${table} query is missing`);
  }
  assert.ok(!/from\("documents"\)/.test(sources.market), "a document count is not a market fact");
  assert.match(sources.market, /Verified awards/);
  assert.match(sources.market, /buildRecompeteRadar\(/);
  // Filters are on fields the schema has.
  assert.match(sources.market, /service_type/);
  assert.match(sources.market, /site_location/);
  assert.match(sources.market, /name="from"[\s\S]{0,120}type="date"/);
});

// --------------------------------------------------------- win rate honesty gate

check("a thin sample withholds the rate and reports the observed counts instead", () => {
  const thin = summarizeWinLoss(["WON", "LOST", "LOST", "NO_BID", "PENDING"]);
  assert.equal(thin.total, 5);
  assert.equal(thin.won, 1);
  assert.equal(thin.lost, 2);
  assert.equal(thin.decided, 3);
  assert.equal(thin.undecided, 2);
  assert.equal(thin.winRatePercent, null, "3 decided pursuits cannot carry a percentage");
  assert.equal(thin.winRateInterval, null);
  assert.match(thin.withheldReason, new RegExp(`at least ${MIN_WIN_RATE_SAMPLE} decided pursuits`));
  assert.match(thin.withheldReason, /Decided so far: 3/);
  assert.equal(summarizeWinLoss([]).winRatePercent, null);
});

check("the rate appears only at the threshold, with n and a confidence interval", () => {
  const justUnder = summarizeWinLoss([
    ...Array(10).fill("WON"),
    ...Array(9).fill("LOST"),
    ...Array(30).fill("NO_BID"),
  ]);
  assert.equal(justUnder.decided, 19);
  assert.equal(justUnder.winRatePercent, null, "30 no-bids must not buy a denominator");

  const atThreshold = summarizeWinLoss([...Array(10).fill("WON"), ...Array(10).fill("LOST")]);
  assert.equal(atThreshold.decided, MIN_WIN_RATE_SAMPLE);
  assert.equal(atThreshold.winRatePercent, 50);
  assert.equal(atThreshold.withheldReason, null);
  assert.ok(atThreshold.winRateInterval.low > 0 && atThreshold.winRateInterval.low < 50);
  assert.ok(atThreshold.winRateInterval.high > 50 && atThreshold.winRateInterval.high < 100);
});

check("only decided outcomes count, and the definition says so", () => {
  assert.deepEqual([...DECIDED_OUTCOMES], ["WON", "LOST"]);
  assert.deepEqual([...UNDECIDED_OUTCOMES], ["NO_BID", "CANCELLED", "NO_AWARD", "PENDING"]);
  const mixed = summarizeWinLoss(["WON", "NO_AWARD", "CANCELLED", "NO_BID", "PENDING", null]);
  assert.equal(mixed.decided, 1);
  assert.equal(mixed.undecided, 5);
  assert.equal(mixed.counts.UNRECORDED, 1, "an absent outcome is counted as unrecorded, not as a loss");
  assert.match(WIN_RATE_DEFINITION, /WON ÷ \(WON \+ LOST\)/);
  assert.match(WIN_RATE_DEFINITION, /decided pursuits, not all pursuits/);
});

check("the Win/Loss view computes the rate over the corpus, not over the filtered table", () => {
  assert.match(sources.winLoss, /summarizeWinLoss\(all\.map\(\(r\) => r\.outcome\)\)/);
  assert.match(sources.winLoss, /const rows: WinLossRow\[\] = all\n\s*\.filter\(/);
  assert.match(sources.winLoss, /data-testid="win-rate"/);
  assert.match(sources.winLoss, /Win rate withheld — sample too thin/);
  assert.match(sources.winLoss, /Filtering changes the table only/);
  assert.match(sources.winLoss, /WIN_RATE_DEFINITION/);
  assert.match(sources.winLoss, /name="outcome"/);
  assert.match(sources.winLoss, /purpose=LOSS_ANALYSIS|from: "win-loss"/);
  assert.ok(
    !/winRatePercent \?\? 0|winRate \|\| 0/.test(sources.winLoss),
    "a withheld rate must not fall back to zero",
  );
});

check("documented reason and internal analysis stay separate, labelled columns", () => {
  assert.match(sources.winLossTable, /header: "Documented reason \(buyer\)"/);
  assert.match(sources.winLossTable, /header: "Internal analysis \(never sent\)"/);
  assert.match(sources.winLossTable, /header: "Lessons \(internal\)"/);
  assert.match(sources.winLossTable, /header: "Winner \(buyer-documented\)"/);
  assert.match(sources.winLoss, /kept distinct/);
  assert.match(sources.winLoss, /Never infer causation without evidence/);
  // Pursuit links exist and point at the recorded result.
  assert.match(sources.winLossTable, /\/procurement\/opportunities\/\$\{row\.opportunity_id\}\/result/);
});

// ------------------------------------------------------------ pricing four truths

check("the four commercial truths stay in four columns, with internal cost apart", () => {
  for (const header of [
    'header: "requested (buyer)"',
    'header: "submitted (L&P)"',
    'header: "awarded (buyer)"',
    'header: "current / amended"',
    'header: "internal_cost (planning)"',
  ]) {
    assert.ok(sources.pricingTable.includes(header), `${header} is missing`);
  }
  assert.match(sources.pricingTable, /never\s*\n?\s*merged into one price/);
  assert.match(sources.pricingTable, /planning column, not a commercial truth/);
  assert.match(sources.pricingTable, /not on file/);
  assert.ok(
    !/requested_rate \?\? .*proposed_rate|\|\| 0/.test(sources.pricingTable),
    "one truth must never stand in for another",
  );
  // Every commercial truth renders with its own provenance.
  for (const factField of [
    "requested_source_fact_id",
    "proposed_source_fact_id",
    "awarded_source_fact_id",
    "current_source_fact_id",
  ]) {
    assert.ok(sources.pricingTable.includes(factField), `${factField} provenance is missing`);
  }
});

check("Pricing stays cross-corpus and hands live bids back to the pursuit", () => {
  assert.match(sources.pricing, /Cross-corpus/);
  assert.match(sources.pricing, /Pursuit → Pricing/);
  assert.match(sources.pricingTable, /\/procurement\/opportunities\/\$\{[^}]*opportunity_id\}\/pricing/);
  assert.match(sources.competitorRatesTable, /\/procurement\/opportunities\/\$\{id\}\/pricing/);
  assert.match(sources.competitorRatesTable, /Pursuit → Pricing/);
  assert.match(sources.competitorRatesTable, /comparables, never a target/);
  assert.match(sources.competitorRatesTable, /decided by a human/);
  // The competitor lines are a real table now, not a bullet list.
  assert.match(sources.pricing, /<CompetitorRatesTable/);
  assert.ok(
    !/competitorLines \?\? \[\]\)\.slice\(0, 25\)\.map/.test(sources.pricing),
    "the old competitor bullet list must be gone",
  );
});

// ------------------------------------------------- competitors observed vs inference

check("competitor evidence is labelled observed or inference, never unlabelled", () => {
  assert.match(sources.competitorTable, /EvidenceBasisBadge/);
  assert.match(sources.competitorTable, /basis="OBSERVED"/);
  assert.match(sources.competitorTable, /basis="INFERENCE"/);
  assert.match(sources.competitors, /OBSERVED_LABEL/);
  assert.match(sources.competitors, /INFERENCE_LABEL/);
  assert.match(sources.competitors, /Not a corporate win rate/);
  assert.match(sources.honestyStrip, /EVIDENCE_BASIS_NOTES\[basis\]/);
  // A cross-pursuit score comparison is explicitly an inference.
  assert.match(sources.competitorTable, /rubrics and weights differ by solicitation/);
  const inferenceTile = sources.competitors.match(/basis: "INFERENCE"/g) ?? [];
  assert.ok(inferenceTile.length >= 1, "a joined count must be tagged as an inference");
});

check("every competitor source cell can be opened and verified", () => {
  assert.match(sources.competitorTable, /header: "Source → verification"/);
  assert.match(sources.competitorTable, /\/ingestion\/verification\/\$\{source\.documentId\}/);
  assert.match(sources.competitorTable, /no source recorded/);
  assert.match(sources.competitors, /source_document_id/);
  assert.match(sources.competitors, /source_fact_id/);
  assert.ok(
    !/fact \$\{row\.source_fact_id\.slice\(0, 8\)\}/.test(sources.competitors),
    "the page must hand the table a source object, not a pre-flattened string",
  );
});

// -------------------------------------------------------------- buyers + content

check("the buyer view is procurement intelligence with real deep links, not CRM", () => {
  assert.match(sources.clients, /Not CRM/);
  assert.match(sources.clients, /procurement intelligence/i);
  assert.match(sources.clients, /loadBuyerPortfolio/);
  assert.ok(
    !/\b(lead|contact cadence|pipeline stage|deal)\b/i.test(sources.clients) ||
      /no contacts, no cadence, no pipeline stage/.test(sources.clients),
    "no CRM object may appear on the buyer view",
  );
  for (const field of ["latest_opportunity_id", "latest_contract_id"]) {
    assert.ok(sources.loadCorpus.includes(field), `${field} is missing from the portfolio loader`);
  }
  assert.match(sources.buyerTable, /\/procurement\/opportunities\/\$\{ctx\.row\.original\.latest_opportunity_id\}/);
  assert.match(sources.buyerTable, /\/result/);
  assert.match(sources.buyerTable, /\/contracts\/\$\{ctx\.row\.original\.latest_contract_id\}/);
  // A zero never pretends to be a link.
  assert.match(sources.buyerTable, /if \(value === 0 \|\| !href\)/);
  // Filters exist and are honest about what they do.
  assert.match(sources.clients, /name="q"/);
  assert.match(sources.clients, /name="evidence"/);
});

check("Content keeps every reuse state and states where the drafting gate lives", () => {
  for (const status of ["APPROVED", "REVIEW_REQUIRED", "DO_NOT_USE", "SUPERSEDED"]) {
    assert.ok(sources.content.includes(status), `${status} is missing from Content`);
  }
  assert.match(sources.content, /purposeRequiresDraftingGates\("PROPOSAL_DRAFTING"\)/);
  assert.match(sources.content, /can never be retrieved for a draft/);
  assert.match(sources.content, /applied by <code>search_verified_knowledge<\/code> in Postgres/);
  assert.match(sources.content, /it does not unlock drafting/);
  assert.match(sources.content, /name="reuse"/);
  assert.match(sources.content, /p_for_drafting: forDrafting/);
});

// ------------------------------------------------------------------- reports

check("all eight report types are exposed, each with purpose, cutoff and Ask launch", () => {
  assert.equal(REPORT_CATALOG.length, 8, "the catalog must expose eight report types");
  for (const item of REPORT_CATALOG) {
    assert.ok(RETRIEVAL_PURPOSES.includes(item.purpose), `${item.kind} has an unknown purpose`);
  }
  assert.match(sources.reports, /REPORT_CATALOG\.map/);
  assert.match(sources.reports, /REPORT_CATALOG\.length/);
  assert.match(sources.reports, /data-testid="report-catalog"/);
  assert.match(sources.reports, /purpose=\{item\.purpose\}|purpose: item\.purpose/);
  assert.match(sources.reports, /Open in Ask/);
  assert.match(sources.reports, /buildAskHref\(\{/);
  // Cutoff, scope, sources and limitations all survive.
  assert.match(sources.reports, /Data cutoff/);
  assert.match(sources.reports, /data cutoff \$\{generatedAt\}/);
  assert.match(sources.reports, /dataScope=/);
  assert.match(sources.reports, /limitations=\{report\.limitations\}/);
  assert.match(sources.reports, /Report sources/);
  assert.match(sources.reports, /insufficient=\{report\.insufficient\}/);
});

// ------------------------------------------------------ /intelligence/buyers fix

check("/intelligence/buyers is redirected, and nothing still links to it as a live route", () => {
  assert.match(sources.buyersRedirect, /permanentRedirect\("\/intelligence\/clients"\)/);
  assert.ok(
    !/liveRoute: "\/intelligence\/buyers"/.test(sources.registry),
    "the data-model registry still advertises the dead route",
  );
  assert.equal((sources.registry.match(/liveRoute: "\/intelligence\/clients"/g) ?? []).length, 2);
  assert.match(sources.homeSnapshot, /href="\/intelligence\/clients"/);
  assert.ok(!/\/intelligence\/buyers/.test(sources.homeSnapshot));
  assert.ok(!/\/intelligence\/buyers/.test(sources.sectionTabs));
  for (const [slug, src] of Object.entries(VIEW_SOURCES)) {
    assert.ok(!/\/intelligence\/buyers/.test(src), `${slug} still links to /intelligence/buyers`);
  }
});

// ------------------------------------------------------------------- reporting

let failed = 0;
for (const result of results) {
  if (result.ok) {
    console.log(`PASS  ${result.name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${result.name}\n      ${result.message}`);
  }
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
