# VERIFY 2A — Pilot corpus acceptance

**Phase:** Canonical Phase 2A (Real-Document Historical Pilot — corpus only)  
**Last run:** 2026-08-20  
**Command:** `npm run test:verify2a`  
**Manifest:** [PILOT_CORPUS_MANIFEST.md](PILOT_CORPUS_MANIFEST.md)

---

## Summary

| Metric | Result |
| --- | --- |
| USABLE files verified | **18 / 18** |
| Distinct packages | **13** |
| Class A / B / C | **3 / 5 / 10** |
| Automated assertions | **132 / 132 PASS** |
| URL-only rows counted | **0** |
| Duplicate Downloads copies double-counted | **0** |

**Verdict:** Phase 2A corpus gate **PASS** — all current-phase blockers resolved.

---

## Fixed (this session)

| Failure | Root cause | Fix |
| --- | --- | --- |
| Manifest summary counts wrong (A=4, C=9) | Doc error vs actual USABLE rows | Corrected to **A=3, B=5, C=10** |
| SRC-06 vendor overclaim | RFP PDF does not name L&P; tie is via SRC-07 staff report | Vendor field + notes: buyer solicitation; L&P in SRC-07 only |
| SRC-01 buyer provenance weak | “Williamson” absent from PDF extract | Notes clarify buyer from source URL/filename; L&P/TXMAS/pricing confirmed in full doc |
| SRC-09 vendor overclaim | L&P not in extracted PDF text | Vendor field: submission not verified; class **B** as buyer solicitation only |
| `verify2a-corpus-audit.mjs` false negatives | Windows cp1252 on Python stdout; weak preview-only checks | JSON stdout via Python + UTF-8 env; full-text/filename identity patterns; class-specific L&P rules |
| No npm script | Missing wiring | Added `test:verify2a` (restored `test:verify1`) |
| No formal acceptance doc | Report lived in chat only | This file |

---

## Still failing

**None** — all Phase 2A corpus blockers pass.

---

## Deferred external dependencies

These are **not** Phase 2A blockers (HUNT / UNAVAILABLE rows; do not count toward USABLE):

| ID | Item | Reason |
| --- | --- | --- |
| HUNT-01 | Frisco L&P bid tab | No retrievable PDF/XLSX on disk |
| — | Jefferson full IFB (beyond SRC-08 tab) | Source URL 404 |
| — | Arlington CDN re-download | HTTP 403; local originals used |
| — | Official GSA instrument PDF | Not acquired |
| — | Terrell BoardBook minutes | Not acquired |
| — | Standalone pricing XLSX | Not acquired |

**Product gate unchanged:** **0 packages through complete ingest pipeline** — Prompt 2B not started.

---

## Test evidence

```text
> npm run test:verify2a
132 passed, 0 failed, 132 total
exit code 0
```

Per-record checks (each USABLE row):

- Local path exists
- Byte size matches manifest
- `%PDF` header
- SHA-256 matches manifest
- Opens and parses (pypdf)
- Buyer/document identity signal
- Classification rule (A L&P signal, B solicitation vs L&P-in-file, C no L&P)

Policy checks:

- Manifest class totals A=3 B=5 C=10
- Five duplicate Downloads copies flagged, not double-counted
- No URL-only paths in fixture

---

## Files touched

- `docs/pilot/PILOT_CORPUS_MANIFEST.md`
- `scripts/verify2a-corpus-audit.mjs`
- `package.json` (`test:verify2a`, `test:verify1`)
- `docs/pilot/VERIFY2A_ACCEPTANCE.md` (this file)
