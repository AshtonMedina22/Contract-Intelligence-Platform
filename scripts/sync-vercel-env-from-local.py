#!/usr/bin/env python3
"""Sync selected keys from apps/web/.env.local into Vercel production (no secret prints)."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / "apps" / "web" / ".env.local"
VERCEL_CMD = str(Path(os.environ.get("APPDATA", "")) / "npm" / "vercel.cmd")
SCOPE = "ashton-medinas-projects"
KEYS = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_JWKS_URL",
    "DATABASE_URL",
    "DIRECT_URL",
    # Lasting operator (for `vercel env pull` on other machines; never commit .env.local)
    "LP_OPERATOR_EMAIL",
    "LP_OPERATOR_PASSWORD",
    "LP_OPERATOR_ORG_NAME",
    # Local processor wiring (optional on Vercel; needed when pulling env for local processor)
    "PROCESSOR_URL",
    "PROCESSOR_SHARED_SECRET",
]


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        out[key.strip()] = val.strip().strip('"').strip("'")
    return out


def main() -> int:
    if not Path(VERCEL_CMD).is_file():
        print(f"Missing vercel at {VERCEL_CMD}", file=sys.stderr)
        return 1
    if not ENV_FILE.is_file():
        print(f"Missing {ENV_FILE}", file=sys.stderr)
        return 1

    env = load_env(ENV_FILE)
    # Required for prod app; operator/processor are synced when present locally.
    required = [
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_URL",
        "SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_SECRET_KEY",
        "SUPABASE_JWKS_URL",
        "DATABASE_URL",
        "DIRECT_URL",
    ]
    missing = [k for k in required if not env.get(k)]
    if missing:
        print(f"Missing local keys: {', '.join(missing)}", file=sys.stderr)
        return 1

    for key in KEYS:
        value = env.get(key)
        if not value:
            print(f"SKIP  {key} (not set locally)")
            continue
        print(f"Updating {key} (len={len(value)}) ...")
        for target in ("production", "preview"):
            r = subprocess.run(
                [
                    VERCEL_CMD,
                    "env",
                    "update",
                    key,
                    target,
                    "--yes",
                    "--scope",
                    SCOPE,
                    "--non-interactive",
                ],
                cwd=str(ROOT),
                text=True,
                input=value,
                capture_output=True,
                check=False,
            )
            if r.returncode != 0:
                err = (r.stderr or r.stdout or "")[-800:]
                print(err, file=sys.stderr)
                print(f"FAILED {key} {target}", file=sys.stderr)
                return r.returncode
        print(f"OK  {key}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
