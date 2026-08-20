# Acquired public pilot PDFs (this machine)

**Purpose:** Re-acquire the ChatGPT/public-records corpus from official URLs so Historical Pilot can continue without the other PC’s Downloads folder.

**Policy:** A/B = L&P-tied; C = competitor test only. Never invent rates. Promote only after HUMAN_VERIFIED.

## On disk now (`docs/pilot/acquired/`)

| File | SRC | Class | SHA-256 vs manifest |
| --- | --- | --- | --- |
| `SRC-01_Williamson_…Final.pdf` | SRC-01 | A | MATCH |
| `SRC-02_Allen_ISD_LP_security_agreement_excerpt.pdf` | SRC-02 | A | MATCH (from repo excerpt) |
| `SRC-03_AllenISD_5-21_board_packet.pdf` | SRC-03 | B | MATCH (~32 MB — use SRC-02 for ingest if 25 MB cap) |
| `SRC-04_TxDMV_PO_0000016167.pdf` | SRC-04 | A | MATCH |
| `SRC-06_Arlington_22-0143-bid-invitation.pdf` | SRC-06 | B | MATCH (browser fetch; curl 403) |
| `SRC-07_Arlington_22-0143-staff-report.pdf` | SRC-07 | B | MATCH (browser fetch; curl 403) |
| `SRC-09_TexasLottery_IFB_RQ22-0480DP.pdf` | SRC-09 | B | MATCH |
| `SRC-13_MHMR_25-003-…Tabulation.pdf` | SRC-13 | C | MATCH |
| `SRC-12b_Tarrant_2018-092_Bid.pdf` | related C | C | New public RFB (not original cost-build-up file) |
| `SRC-C_Tarrant_2023-105_award_tab.pdf` | related C | C | Newer Tarrant award tab (extra corpus) |

## Still missing locally (portal / 404 / no stable URL)

| Manifest | Why |
| --- | --- |
| SRC-08 Jefferson tab (`12.pdf`) | Original IFB URL 404; opaque local-only filename |
| SRC-10 / SRC-11 Dallas tabs | No stable public file found this session |
| SRC-12 original cost-build PDF | Different from RFB bid packet we downloaded |
| SRC-14 Harris CPI renewal | Legistar item not re-found as same PDF |
| SRC-15 / SRC-16 TFC VSA contract+amend | Listing exists; VIEW links portal-gated |
| SRC-17–19 Arlington VA (VA county) | Local-only previously |
| Frisco L&P tab (HUNT-01) | Still unavailable |
| Standalone XLSX workbook | Still unavailable |

## Drive source folder (on-the-job path)

Target folder: https://drive.google.com/drive/folders/1_I4Kt4uKTSX0934q6mJEErNLKz8yxYvF  

**Product rule:** Drive = import/source only. Evidence vault stays **Supabase Storage**.  
Upload script: `python scripts/upload-pilot-acquired-to-drive.py` (needs `GOOGLE_DRIVE_ACCESS_TOKEN`).  
Then ingest via Data Ops → Intake → **Import from Google Drive** (paste file ID).
