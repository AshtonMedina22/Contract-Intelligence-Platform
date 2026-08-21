# F14 Past Performance / Experience Integrity — external references

**Task:** Functional Build F14 (2026-08-21).

**Consulted (pattern only, max 3):** OpenContracts · RFPilot · AutoRFP

## What we took (patterns only)

| Source | Pattern adopted | Declined |
| --- | --- | --- |
| **OpenContracts** | Source ↔ fact provenance; human verification before canonical use; View Source | Annotation UI / OCR pipeline rewrite |
| **RFPilot** | Past-performance as a distinct proposal taxonomy section; requirement↔capability match shape | Unsourced match scores; invented win tips; auto-corporate claims |
| **AutoRFP** | Requirement-driven response assembly that can pull prior evidence | Any merge of corporate / personnel / sub experience into one PP blob |

## Local authority

This repo’s integrity rules win:

- Types never merge: `L_AND_P_CORPORATE` ≠ management prior ≠ key personnel ≠ subcontractor
- Prior-employer work is never rewritten as L&P performance
- Value and years stay blank unless sourced
- AI cannot set `HUMAN_VERIFIED`
- Only `HUMAN_VERIFIED` `L_AND_P_CORPORATE` counts as L&P corporate past performance
- `experience_references` alone never upgrades a row to corporate PP

No upstream code was copied. AGPL / unclear projects remain reference-only.
