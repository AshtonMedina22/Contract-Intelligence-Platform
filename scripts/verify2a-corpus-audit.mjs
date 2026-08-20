import { createHash } from "node:crypto";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = join(import.meta.dirname, "..");
const DOWNLOADS = "C:\\Users\\Ashto\\Downloads";

/** Must match docs/pilot/PILOT_CORPUS_MANIFEST.md USABLE rows. */
const RECORDS = [
  {
    id: "SRC-01",
    path: join(DOWNLOADS, "1770_43.35658_Services_Contract_with_proposal_Final.pdf"),
    sha: "0a3e3762d64da3cd074ed8fb1678528f499d18fc9fc75f2d86fca732040024fa",
    size: 4169850,
    cls: "A",
    buyer: "Williamson County",
    dtype: "contract+proposal",
    identity: /TXMAS|GLOBAL SECURITY|31\.45|L&P|L AND P/i,
  },
  {
    id: "SRC-02",
    path: join(ROOT, "docs/pilot/source-pdfs/Allen_ISD_LP_security_agreement_excerpt.pdf"),
    sha: "44497b51d423b4f282a58fb217caff64271ca7097a6317fa347a6c3019a2c658",
    size: 334504,
    cls: "A",
    buyer: "Allen ISD",
    dtype: "agreement excerpt",
    identity: /ALLEN|L&P|32\.28|08\/01\/2024/i,
  },
  {
    id: "SRC-03",
    path: join(DOWNLOADS, "5-21_AllenISD.pdf"),
    sha: "2521a6b57c017ca2b735cc0ae7484ef957b0a2162592c9ec46965c7b514520de",
    size: 32599851,
    cls: "B",
    buyer: "Allen ISD",
    dtype: "board packet",
    identity: /ALLEN|Board of Trustees/i,
  },
  {
    id: "SRC-04",
    path: join(DOWNLOADS, "60800 0000016167.pdf"),
    sha: "e1f3f631bdc5efa30b08a4201a08ef1977698ef7300a07c5534c6c4892704a0a",
    size: 38345,
    cls: "A",
    buyer: "TxDMV",
    dtype: "PO",
    identity: /Motor Vehicle|0000016167|L&P|TXMAS/i,
  },
  {
    id: "SRC-06",
    path: join(DOWNLOADS, "22-0143-bid-invitation.pdf"),
    sha: "98efc54a7659afc29d12932559c9fbcb0e9a1844c9de45f77860bf6851a6127f",
    size: 290544,
    cls: "B",
    buyer: "Arlington TX",
    dtype: "solicitation",
    identity: /22-0143|Arlington|Security Guard/i,
    lpInFile: false,
  },
  {
    id: "SRC-07",
    path: join(DOWNLOADS, "22-0143-staff-report.pdf"),
    sha: "855ff7cd00d2f5d5cf1d5ceb7be177850e1a6e43cc99529c50a500fc7093490d",
    size: 165355,
    cls: "B",
    buyer: "Arlington TX",
    dtype: "eval/award",
    identity: /22-0143|L&P|70\.48|90\.46|Vets/i,
    lpInFile: true,
  },
  {
    id: "SRC-08",
    path: join(DOWNLOADS, "12.pdf"),
    sha: "72fbde263e5deae24c643042946ac013cab672c9365779652d8aab6c2ad976fd",
    size: 31322,
    cls: "B",
    buyer: "Jefferson County",
    dtype: "bid tab",
    identity: /18-009|Jefferson|L & P Global|18\.75/i,
    lpInFile: true,
  },
  {
    id: "SRC-09",
    path: join(DOWNLOADS, "IFB_for_Security_Officer_Services_RQ22-0480DP_FINAL.pdf"),
    sha: "d0a7069266a158657dfb72d25d1ac72c1eab3eb534ae468f72be24688613bb40",
    size: 6261092,
    cls: "B",
    buyer: "Texas Lottery",
    dtype: "solicitation",
    identity: /Lottery|RQ22-0480/i,
    lpInFile: false,
  },
  {
    id: "SRC-10",
    path: join(DOWNLOADS, "BID TAB 16-0219.PDF"),
    sha: "6a6e13e8151922c7fac8f7f126d4939c1b53c779430b20af6777c93b2f92c3a6",
    size: 23687,
    cls: "C",
    buyer: "Dallas County",
    dtype: "bid tab",
    identity: /16-0219|Dallas/i,
    lpInFile: false,
  },
  {
    id: "SRC-11",
    path: join(DOWNLOADS, "2014-036-6418SecurityGuard.pdf"),
    sha: "eebc7e7232a27e922ed4480d78a586f88c3b117bef146fa17aaa28ccdbc28962",
    size: 18541,
    cls: "C",
    buyer: "Dallas County",
    dtype: "synopsis",
    identity: /2014-036|Vets Securing/i,
    lpInFile: false,
  },
  {
    id: "SRC-12",
    path: join(DOWNLOADS, "2018-092_AnnualContractforSecurityGuardServices.pdf"),
    sha: "8008be838b0502d6957c3cdec9c13991ea6e3fc76a005ff006eb9764169f1be6",
    size: 23572,
    cls: "C",
    buyer: "Tarrant County",
    dtype: "cost build",
    identity: /2018-092|Direct Wages|Workers Comp/i,
    lpInFile: false,
  },
  {
    id: "SRC-13",
    path: join(DOWNLOADS, "25-003-Security-Guard-Services-Tabulation.pdf"),
    sha: "5ebf4975b592d381f48a6f0623d703bbd2170bd35f0160b80ae6d18d2e2f7b45",
    size: 643286,
    cls: "C",
    buyer: "MHMR Tarrant",
    dtype: "bid tab",
    identity: /25-003|Blackstone|Andy Frain/i,
    lpInFile: false,
  },
  {
    id: "SRC-14",
    path: join(DOWNLOADS, "26-0534 Renewal Job No. 220401 - Vets Securing America.pdf"),
    sha: "21a3f215cf8bca032692fc3fd40cc522a12d07e62297a34aba9901b5c9692cdd",
    size: 80083,
    cls: "C",
    buyer: "Harris County",
    dtype: "renewal",
    identity: /Harris|220401|26-0534|Vets/i,
    lpInFile: false,
  },
  {
    id: "SRC-15",
    path: join(DOWNLOADS, "Vets Securing 24-001-000 Redacted Original.pdf"),
    sha: "8f80d1b9461174abcf2898e0d45d16e96c945051dadb6a3e1523ee9008cb0d4a",
    size: 3887551,
    cls: "C",
    buyer: "TFC",
    dtype: "contract",
    identity: /24-001-000|Facilities Commission|Vets Securing/i,
    lpInFile: false,
  },
  {
    id: "SRC-16",
    path: join(DOWNLOADS, "VSA 24-001 Amend 4.pdf"),
    sha: "b91a8441f18f1a3f5409750acbed97c223194670cd5a39a1d1ff27cef575e0f4",
    size: 976191,
    cls: "C",
    buyer: "TFC",
    dtype: "amendment",
    identity: /24-001|Amendment|Vets Securing/i,
    lpInFile: false,
  },
  {
    id: "SRC-17",
    path: join(DOWNLOADS, "Contract19-264-RFullyExecuted&NOA.pdf"),
    sha: "bb2658f90ec690cc005112c2447150d1622a208085d20e2a877d6588cb591fe6",
    size: 503650,
    cls: "C",
    buyer: "Arlington County VA",
    dtype: "contract+NOA",
    identity: /19-264|SOS SECURITY|ARLINGTON/i,
    lpInFile: false,
  },
  {
    id: "SRC-18",
    path: join(DOWNLOADS, "19-264-RAmendment2signed.pdf"),
    sha: "831ece226849794a07c6ff64aead2e2d3f507b94b2593cf59d15e62f9fd95eeb",
    size: 240634,
    cls: "C",
    buyer: "Arlington County VA",
    dtype: "amendment",
    identity: /19-264/i,
    identityFromFilename: true,
    lpInFile: false,
  },
  {
    id: "SRC-19",
    path: join(DOWNLOADS, "19-264-RA3Final.pdf"),
    sha: "4f05f6ecdced56b8fa5eaccae5abba34ad32a06e0f22a61edc7591f6411b22c6",
    size: 1984573,
    cls: "C",
    buyer: "Arlington County VA",
    dtype: "amendment scan",
    identity: /19-264/i,
    identityFromFilename: true,
    lpInFile: false,
  },
];

const MANIFEST_CLASS_TOTALS = { A: 3, B: 5, C: 10 };

const DUP_CANDIDATES = [
  join(DOWNLOADS, "5-21_AllenISD (1).pdf"),
  join(DOWNLOADS, "5-21_AllenISD (2).pdf"),
  join(DOWNLOADS, "60800 0000016167 (1).pdf"),
  join(DOWNLOADS, "22-0143-bid-invitation (1).pdf"),
  join(DOWNLOADS, "22-0143-staff-report (1).pdf"),
];

const results = [];

function record(area, name, ok, detail = "") {
  results.push({ area, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${area}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function pdfAnalyze(path) {
  const py = spawnSync(
    "python",
    [
      "-c",
      `import json, sys
from pypdf import PdfReader
path = sys.argv[1]
r = PdfReader(path)
text = "".join((p.extract_text() or "") for p in r.pages)
print(json.dumps({"pages": len(r.pages), "chars": len(text), "text": text[:8000]}))`,
      path,
    ],
    { encoding: "utf8", timeout: 180000, env: { ...process.env, PYTHONIOENCODING: "utf-8" } },
  );
  if (py.status !== 0) {
    return { ok: false, err: py.stderr?.slice(0, 300) ?? "python failed" };
  }
  try {
    return { ok: true, ...JSON.parse(py.stdout.trim()) };
  } catch {
    return { ok: false, err: "invalid json from python" };
  }
}

function lpPresent(text) {
  return /L&P|L AND P|L & P GLOBAL|LP GLOBAL/i.test(text);
}

// Manifest class totals must match RECORDS.
const classCounts = { A: 0, B: 0, C: 0 };
for (const rec of RECORDS) classCounts[rec.cls] += 1;
record(
  "manifest",
  "class totals match PILOT_CORPUS_MANIFEST (A=3 B=5 C=10)",
  classCounts.A === MANIFEST_CLASS_TOTALS.A &&
    classCounts.B === MANIFEST_CLASS_TOTALS.B &&
    classCounts.C === MANIFEST_CLASS_TOTALS.C,
  `actual A=${classCounts.A} B=${classCounts.B} C=${classCounts.C}`,
);

for (const rec of RECORDS) {
  const area = rec.id;
  if (!existsSync(rec.path)) {
    record(area, "local file exists", false, rec.path);
    continue;
  }
  record(area, "local file exists", true);

  const st = statSync(rec.path);
  record(area, "byte size matches manifest", st.size === rec.size, `manifest=${rec.size} actual=${st.size}`);

  const header = readFileSync(rec.path, { encoding: null }).subarray(0, 5).toString("ascii");
  record(area, "PDF header", header.startsWith("%PDF"), header);

  const sha = sha256File(rec.path);
  record(area, "SHA-256 matches manifest", sha === rec.sha, sha === rec.sha ? sha.slice(0, 16) + "…" : `expected ${rec.sha}`);

  const analyzed = pdfAnalyze(rec.path);
  if (!analyzed.ok) {
    record(area, "opens and parses (pypdf)", false, analyzed.err);
    continue;
  }
  record(area, "opens and parses (pypdf)", analyzed.pages > 0, `${analyzed.pages} pages, ${analyzed.chars} chars extracted`);

  const idOk = rec.identityFromFilename
    ? rec.identity.test(rec.path)
    : rec.identity.test(analyzed.text);
  record(area, "buyer/document identity signal", idOk, rec.identityFromFilename ? "filename pattern" : "full-text pattern");

  const hasLp = lpPresent(analyzed.text);
  if (rec.cls === "C") {
    record(area, "class C has no L&P vendor text", !hasLp, hasLp ? "L&P found in competitor corpus" : "no L&P");
  } else if (rec.lpInFile === true) {
    record(area, "class A/B L&P-tied signal in file", hasLp, hasLp ? "L&P present" : "missing L&P");
  } else if (rec.lpInFile === false && rec.cls === "B") {
    record(area, "buyer solicitation without L&P name (L&P-tied via package)", !hasLp, "expected for SRC-06-style solicitations");
  } else if (rec.cls === "A") {
    record(area, "class A L&P originated signal", hasLp || /GLOBAL SECURITY/i.test(analyzed.text), "L&P or L&P Global Security");
  }
}

for (const p of DUP_CANDIDATES) {
  if (!existsSync(p)) continue;
  const sha = sha256File(p);
  const match = RECORDS.find((r) => existsSync(r.path) && sha256File(r.path) === sha);
  record("duplicate", `${p.split("\\").pop()} is duplicate not double-counted`, Boolean(match), match ? `duplicate of ${match.id}` : "unknown");
}

record(
  "policy",
  "no URL-only rows in RECORDS fixture",
  RECORDS.every((r) => r.path && !r.path.startsWith("http")),
  `${RECORDS.length} local paths`,
);

const failed = results.filter((r) => !r.ok).length;
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed} passed, ${failed} failed, ${results.length} total`);
process.exit(failed > 0 ? 1 : 0);
