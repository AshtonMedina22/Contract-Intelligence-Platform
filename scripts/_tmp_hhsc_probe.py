"""Probe nearby HHSC ESBD award IDs for more L&P Global Security awards."""
from __future__ import annotations

import hashlib
import re
import urllib.request
from pathlib import Path

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}
OUT = Path("docs/pilot/acquired")
PAT = re.compile(r"L\s*&?\s*P\s+Global\s+Security", re.I)

# Known hits: HHSTX-6-0000383549, HHSTX-5-0000357097
CANDS = []
for n in range(357000, 357200):
    CANDS.append(f"HHSTX-5-0000{n}")
for n in range(383400, 383700):
    CANDS.append(f"HHSTX-6-0000{n}")
for n in range(355000, 356000, 50):
    CANDS.append(f"HHSTX-5-0000{n}")
for n in range(380000, 385000, 100):
    CANDS.append(f"HHSTX-6-0000{n}")
# also HHSTX-4 and HHSTX-7 samples
for n in [347000, 350000, 360000, 370000, 390000, 400000, 410000]:
    CANDS.append(f"HHSTX-4-0000{n}")
    CANDS.append(f"HHSTX-7-0000{n}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    hits = []
    checked = 0
    # dedupe preserve order
    seen = set()
    uniq = []
    for c in CANDS:
        if c in seen:
            continue
        seen.add(c)
        uniq.append(c)
    for po in uniq:
        if po in ("HHSTX-6-0000383549", "HHSTX-5-0000357097"):
            continue
        url = f"https://www.txsmartbuy.gov/esbdawards/{po}"
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=20) as resp:
                html = resp.read().decode("utf-8", "ignore")
        except Exception:
            continue
        checked += 1
        if "Award No Solicitation" not in html and "PO Number" not in html:
            continue
        if PAT.search(html):
            hits.append(po)
            print("HIT", po)
            # extract amount
            m = re.search(r"PO Amount:.*?([0-9,]+\.\d{2})", html, re.S)
            print("  amount", m.group(1) if m else "?")
            if len(hits) >= 8:
                break
        if checked % 40 == 0:
            print("checked", checked, "last", po)
    print("DONE checked", checked, "hits", hits)


if __name__ == "__main__":
    main()
