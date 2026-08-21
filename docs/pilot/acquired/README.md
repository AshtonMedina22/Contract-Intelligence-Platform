# Acquired public pilot PDFs (this machine)

**Purpose:** Re-acquire the ChatGPT/public-records corpus from official URLs so Historical Pilot can continue without depending on another PC’s Downloads folder.

**Policy:** A/B = L&P-tied; C = competitor test only. Never invent rates. Promote only after HUMAN_VERIFIED. Harness stamps are **not** the same as Verification workbench eyeballs.

**Git:** PDFs under this folder are **gitignored** (see `.gitignore`). Only this README is tracked.

## On disk now (`docs/pilot/acquired/`)

| File | SRC | Class | Notes |
| --- | --- | --- | --- |
| `SRC-01_Williamson_…Final.pdf` | SRC-01 | A | MATCH |
| `SRC-02_Allen_ISD_LP_security_agreement_excerpt.pdf` | SRC-02 | A | From repo excerpt |
| `SRC-03_AllenISD_5-21_board_packet.pdf` | SRC-03 | B | ~32 MB |
| `SRC-04_TxDMV_PO_0000016167.pdf` | SRC-04 | A | MATCH |
| `SRC-06_Arlington_22-0143-bid-invitation.pdf` | SRC-06 | B | MATCH |
| `SRC-07_Arlington_22-0143-staff-report.pdf` | SRC-07 | B | MATCH |
| `SRC-08_Jefferson_bid_tab_12.pdf` | SRC-08 | B | Restored from Downloads `12.pdf` |
| `SRC-09_TexasLottery_IFB_RQ22-0480DP.pdf` | SRC-09 | B | MATCH |
| `SRC-10_Dallas_BID_TAB_16-0219.PDF` | SRC-10 | C | MATCH |
| `SRC-11_Dallas_2014-036-6418SecurityGuard.pdf` | SRC-11 | C | MATCH |
| `SRC-12_Tarrant_2018-092_AnnualContract.pdf` | SRC-12 | C | RFB packet (not original cost-build-up) |
| `SRC-13_MHMR_25-003-…Tabulation.pdf` | SRC-13 | C | MATCH |
| `SRC-14_Harris_26-0534_Renewal_VSA.pdf` | SRC-14 | C | MATCH |
| `SRC-15_TFC_Vets_Securing_24-001-000_Redacted.pdf` | SRC-15 | C | MATCH |
| `SRC-16_TFC_VSA_24-001_Amend_4.pdf` | SRC-16 | C | MATCH |
| `SRC-17_ArlingtonVA_Contract19-264-R_NOA.pdf` | SRC-17 | C | MATCH |
| `SRC-18_ArlingtonVA_19-264-RAmendment2signed.pdf` | SRC-18 | C | MATCH |
| `SRC-19_ArlingtonVA_19-264-RA3Final.pdf` | SRC-19 | C | Scan — extract often empty without OCR |

## Still hard to grow beyond ~13 packages

| Gap | Why |
| --- | --- |
| Frisco L&P tab (HUNT-01) | Still unavailable |
| Standalone XLSX workbook | Still unavailable |
| Additional L&P A/B packages | Need new public or private acquisitions toward ~20–30 |

## Drive source folder

Target: https://drive.google.com/drive/folders/1_I4Kt4uKTSX0934q6mJEErNLKz8yxYvF  

Drive = import/source only. Vault = **Supabase Storage**.  
Upload: `python scripts/upload-pilot-acquired-to-drive.py` (needs `GOOGLE_DRIVE_ACCESS_TOKEN`).
