# Acquisition Run (F23)

Started: 2026-08-21T20:57:41.838Z  
Finished: 2026-08-21T21:00:23.941Z (fetch) · re-ingest 2026-08-21T21:03Z  
Organization: `f9f6632f-b00f-41b0-9289-86c755408ae5`

## Summary

| Metric | Count |
| --- | ---: |
| Registry seeds parsed | 32 |
| Candidates in DB | 58 |
| Vault ingested (new) | 3 |
| Vault duplicates (already present) | 3 |
| Local binary / JSON acquired | 7 |
| Link-only | 33 |
| Manual import | 2 |
| Failed | 1 (Jefferson bid tab HTTP 404) |
| With document_id | 6 |
| With checksum | 7 |

## Exact URLs successfully acquired (binary + checksum)

| URL | sha256 (prefix) | Vault |
| --- | --- | --- |
| https://ftp.txdmv.gov/pub/txdmv-info/fas/contract_reporting/60800%200000016167.pdf | `e1f3f631bdc5…` | DUPLICATE |
| https://swagit-attachments.granicus.com/uploads/video/agenda_file/306017/5-21_AllenISD.pdf | `2521a6b57c01…` | DUPLICATE |
| https://public.destinyhosted.com/wilcomindocs/2024/COM/20241126_1872/1770_43.35658_Services_Contract_with_proposal_Final.pdf | `0a3e3762d64d…` | DUPLICATE |
| https://swagit-attachments.granicus.com/uploads/video/agenda_file/308143/6-17_AllenISD.pdf | `785ea4df495e…` | **INGESTED** |
| https://swagit-attachments.granicus.com/uploads/video/agenda_file/270610/9-1_MesquiteISD.pdf | `2b19790b75d2…` | **INGESTED** |
| https://www.dps.texas.gov/sites/default/files/documents/rsd/psb/finaldiscactions/company/202511pscodiscactions.pdf | `de1afcdf50ba…` | **INGESTED** |
| https://data.texas.gov/resource/de7b-7dna.json?$limit=15 | (JSON REFERENCE_DATA) | local only |

## Exact URLs inaccessible / manual-only

| URL | Outcome |
| --- | --- |
| https://jeffersoncountytx.gov/Purchasing/NoticesForBid/View/TAB/12 | FAILED — HTTP 404 |
| https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/3952/Aisd/…/Contracted_Vendors_….pdf | MANUAL_IMPORT — HTTP 403 (not bypassed) |
| https://lancasterisd.community.diligentoneplatform.com/document/9854/…docx?handle=… | LINK_ONLY — HTML portal / no binary |
| https://lancasterisd.community.diligentoneplatform.com/Portal/VotingRecords.aspx?… | LINK_ONLY |
| https://tops.portal.texas.gov/psp-self-service/search/result/62670?type=business | LINK_ONLY — TOPS HTML |
| https://sam.gov/opportunities (+ API roots) | MANUAL/LINK — `SAM_GOV_API_KEY` unset |

## Search saturation (honest)

| Provider | Query | Results | Mode |
| --- | --- | --- | --- |
| usa_spending | L&P Global Security | **0** | live |
| usa_spending | NAICS 561612 | **25** (10 LINK_ONLY REFERENCE_DATA recorded) | live |
| sam_gov | L&P / 561612 | — | skipped (no API key) |
| socrata | TxDOT bid tabs `de7b-7dna` | **15** | live |
| web_discovery | 4 buyer spot queries | — | manual_lead only (no SERP scrape) |

## Trust

- No `HUMAN_VERIFIED` from this path (AI_EXTRACTED / vault register only)
- Binaries under `docs/corpus/downloads/` and `docs/pilot/acquired/` are **gitignored**
- USAspending / SAM / Socrata are REFERENCE_DATA or LINK_ONLY — not fabricated packages
- First-pass vault ingest required operator JWT (service role storage RLS) — fixed; re-ingest completed for new PDFs
