"""Hunt Frisco / Rockwall / Kaufman BoardBook orgs for L&P Global Security."""
from __future__ import annotations

import re
import urllib.request
from pathlib import Path

UA = {"User-Agent": "Mozilla/5.0"}
OUT = Path("docs/pilot/acquired")
PAT = re.compile(r"(?:L\s*&\s*P|L\s+and\s+P|LandP)\s*Global|Global\s+Security,\s*LLC", re.I)
ORGS = {
    # candidates: name -> org id if known
    "Frisco": None,
    "Rockwall": None,
    "Kaufman": None,
    "Forney": None,
}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read().decode("utf-8", "ignore")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    # BoardBook public search isn't indexed well; probe known DFW org IDs near ones we know
    # Known: Allen 855, Terrell 1294, Mesquite 1314, Wylie Collin 3480
    candidates = list(range(800, 900)) + list(range=1200, 1350) + list(range(2000, 2200)) + [3480, 2118]
    # Fix syntax - rewrite below


if __name__ == "__main__":
    main()
