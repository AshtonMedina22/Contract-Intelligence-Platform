"""Scan Frisco BoardBook org 1721 for L&P Global Security attachments."""
from __future__ import annotations

import hashlib
import re
import urllib.request
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:
    from PyPDF2 import PdfReader  # type: ignore

UA = {"User-Agent": "Mozilla/5.0"}
OUT = Path("docs/pilot/acquired")
ORG = 1721
PAT = re.compile(r"(?:L\s*&\s*P|L\s+and\s+P|LandP)\s*Global|Global\s+Security,\s*LLC", re.I)


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    html = fetch_bytes(f"https://meetings.boardbook.org/Public/Organization/{ORG}").decode("utf-8", "ignore")
    title = re.search(r"<title>([^<]+)", html, re.I)
    print("org title", title.group(1) if title else "?")
    mids = sorted({int(x) for x in re.findall(rf"(?:Agenda|Minutes)/{ORG}\?meeting=(\d+)", html)}, reverse=True)
    print("meetings", len(mids))
    hits = 0
    for i, mid in enumerate(mids[:120]):
        try:
            h = fetch_bytes(f"https://meetings.boardbook.org/Public/Agenda/{ORG}?meeting={mid}").decode(
                "utf-8", "ignore"
            )
        except Exception as exc:  # noqa: BLE001
            print("fail", mid, exc)
            continue
        if PAT.search(h):
            t = re.search(r"<title>([^<]+)", h, re.I)
            files = re.findall(r"file=(\d+)", h)
            print("HIT", mid, t.group(1) if t else "", "files", files[:10])
            hits += 1
            for j, fid in enumerate(files[:8], 1):
                try:
                    data = fetch_bytes(f"https://meetings.boardbook.org/Documents/DownloadPDF/{fid}?org={ORG}")
                    if data[:5] != b"%PDF-":
                        continue
                    dest = OUT / f"SRC-31_Frisco_m{mid}_{j}_{fid}.pdf"
                    dest.write_bytes(data)
                    text = "\n".join((p.extract_text() or "") for p in PdfReader(str(dest)).pages[:12])
                    ok = bool(PAT.search(text))
                    print(" ", dest.name, len(data), "lp_in_pdf", ok, hashlib.sha256(data).hexdigest()[:16])
                    if not ok:
                        dest.unlink(missing_ok=True)
                except Exception as exc:  # noqa: BLE001
                    print("  dl fail", fid, type(exc).__name__)
            if hits >= 4:
                break
        if (i + 1) % 30 == 0:
            print("checked", i + 1)
    print("done hits", hits)


if __name__ == "__main__":
    main()
