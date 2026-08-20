#!/usr/bin/env python3
"""Upload docs/pilot/acquired/*.pdf into a Google Drive folder (source only).

Architecture: Drive = import source; platform vault = Supabase Storage.
Requires GOOGLE_DRIVE_ACCESS_TOKEN (OAuth bearer with drive.file or drive scope).

Usage:
  set GOOGLE_DRIVE_ACCESS_TOKEN=ya29....
  set GOOGLE_DRIVE_FOLDER_ID=1_I4Kt4uKTSX0934q6mJEErNLKz8yxYvF   # optional
  python scripts/upload-pilot-acquired-to-drive.py

Or put GOOGLE_DRIVE_ACCESS_TOKEN in apps/web/.env.local (never commit).
"""
from __future__ import annotations

import json
import mimetypes
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ACQUIRED = ROOT / "docs" / "pilot" / "acquired"
ENV_LOCAL = ROOT / "apps" / "web" / ".env.local"
DEFAULT_FOLDER = "1_I4Kt4uKTSX0934q6mJEErNLKz8yxYvF"


def load_token() -> str:
    token = os.environ.get("GOOGLE_DRIVE_ACCESS_TOKEN", "").strip()
    if token:
        return token
    if ENV_LOCAL.is_file():
        for raw in ENV_LOCAL.read_text(encoding="utf-8").splitlines():
            if raw.startswith("GOOGLE_DRIVE_ACCESS_TOKEN="):
                return raw.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def upload(token: str, folder_id: str, path: Path) -> dict:
    meta = {
        "name": path.name,
        "parents": [folder_id],
    }
    boundary = "cipboundary7MA4YWxkTrZu0gW"
    mime = mimetypes.guess_type(path.name)[0] or "application/pdf"
    body = (
        f"--{boundary}\r\n"
        f'Content-Type: application/json; charset=UTF-8\r\n\r\n'
        f"{json.dumps(meta)}\r\n"
        f"--{boundary}\r\n"
        f"Content-Type: {mime}\r\n\r\n"
    ).encode("utf-8") + path.read_bytes() + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = urllib.request.Request(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/related; boundary={boundary}",
        },
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    token = load_token()
    if not token:
        print(
            "Missing GOOGLE_DRIVE_ACCESS_TOKEN.\n"
            "1) Create an OAuth access token with Drive scope (Google Cloud Console / OAuth playground),\n"
            "2) Put it in apps/web/.env.local as GOOGLE_DRIVE_ACCESS_TOKEN=...,\n"
            "3) Re-run this script.\n"
            "Or upload the PDFs manually into the folder, then paste each file ID into Data Ops → Intake.",
            file=sys.stderr,
        )
        return 1

    folder = os.environ.get("GOOGLE_DRIVE_FOLDER_ID", DEFAULT_FOLDER).strip() or DEFAULT_FOLDER
    pdfs = sorted(ACQUIRED.glob("*.pdf"))
    if not pdfs:
        print(f"No PDFs in {ACQUIRED}", file=sys.stderr)
        return 1

    print(f"Uploading {len(pdfs)} PDF(s) to folder {folder} ...")
    ok = 0
    for path in pdfs:
        try:
            result = upload(token, folder, path)
            print(f"OK  {path.name} → id={result.get('id')}")
            ok += 1
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="replace")[:400]
            print(f"FAIL {path.name}: HTTP {e.code} {detail}", file=sys.stderr)
        except Exception as e:
            print(f"FAIL {path.name}: {e}", file=sys.stderr)

    print(f"Done: {ok}/{len(pdfs)} uploaded.")
    print("Next: set the same token for the app, then Data Ops → Intake → Import from Google Drive (file ID).")
    return 0 if ok == len(pdfs) else 2


if __name__ == "__main__":
    raise SystemExit(main())
