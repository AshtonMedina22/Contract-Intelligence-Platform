#!/usr/bin/env python3
"""Apply pending supabase/migrations/*.sql to live DB using DIRECT_URL from apps/web/.env.local.

Does not print connection secrets. Records versions in supabase_migrations.schema_migrations.
"""
from __future__ import annotations

import os
import subprocess
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / "apps" / "web" / ".env.local"
MIGRATIONS_DIR = ROOT / "supabase" / "migrations"
PSQL = r"C:\Program Files\PostgreSQL\16\bin\psql.exe"


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        out[key.strip()] = val.strip().strip('"').strip("'")
    return out


def parse_direct_url(url: str) -> dict[str, str]:
    parsed = urllib.parse.urlparse(url)
    if not parsed.hostname or not parsed.username:
        raise SystemExit("DIRECT_URL missing host or username")
    password = urllib.parse.unquote(parsed.password or "")
    db = (parsed.path or "/postgres").lstrip("/") or "postgres"
    return {
        "host": parsed.hostname,
        "port": str(parsed.port or 5432),
        "user": urllib.parse.unquote(parsed.username),
        "password": password,
        "dbname": db,
    }


def run_psql(conn: dict[str, str], *extra: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PGPASSWORD"] = conn["password"]
    env["PGSSLMODE"] = "require"
    cmd = [
        PSQL,
        "-h",
        conn["host"],
        "-p",
        conn["port"],
        "-U",
        conn["user"],
        "-d",
        conn["dbname"],
        "-v",
        "ON_ERROR_STOP=1",
        *extra,
    ]
    return subprocess.run(cmd, env=env, text=True, capture_output=True, check=False)


def main() -> int:
    if not ENV_FILE.is_file():
        print(f"Missing {ENV_FILE}", file=sys.stderr)
        return 1
    if not Path(PSQL).is_file():
        print(f"Missing psql at {PSQL}", file=sys.stderr)
        return 1

    env = load_env(ENV_FILE)
    url = env.get("DIRECT_URL") or env.get("DATABASE_URL")
    if not url:
        print("DIRECT_URL / DATABASE_URL not set in .env.local", file=sys.stderr)
        return 1

    conn = parse_direct_url(url)
    print(f"Connecting host={conn['host']} port={conn['port']} db={conn['dbname']} user={conn['user']}")

    probe = run_psql(
        conn,
        "-tA",
        "-c",
        "select version from supabase_migrations.schema_migrations order by version;",
    )
    if probe.returncode != 0:
        print(probe.stderr.strip() or probe.stdout.strip(), file=sys.stderr)
        return probe.returncode

    applied = {line.strip() for line in probe.stdout.splitlines() if line.strip()}
    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    pending: list[tuple[str, Path]] = []
    for f in files:
        version = f.name.split("_", 1)[0]
        if version not in applied:
            pending.append((version, f))

    print(f"Applied migrations: {len(applied)}")
    print(f"Pending migrations: {len(pending)}")
    for version, f in pending:
        print(f"  - {f.name}")

    if not pending:
        print("Nothing to apply.")
        # Still verify trust objects exist
        verify = run_psql(
            conn,
            "-tA",
            "-c",
            "select count(*) from pg_trigger where tgname in ('document_chunks_require_verified_fact','contracts_require_verified_fact');",
        )
        print(f"Trust triggers present: {(verify.stdout or '').strip()}")
        return 0

    for version, path in pending:
        print(f"Applying {path.name} ...")
        result = run_psql(conn, "-f", str(path))
        if result.returncode != 0:
            print(result.stderr or result.stdout, file=sys.stderr)
            print(f"FAILED on {path.name}", file=sys.stderr)
            return result.returncode
        record = run_psql(
            conn,
            "-c",
            f"insert into supabase_migrations.schema_migrations (version) values ('{version}') on conflict do nothing;",
        )
        if record.returncode != 0:
            # Some projects use (version, name) or statements column — try alternate
            alt = run_psql(
                conn,
                "-c",
                f"insert into supabase_migrations.schema_migrations (version, name) values ('{version}', '{path.name}') on conflict do nothing;",
            )
            if alt.returncode != 0:
                print(record.stderr or record.stdout, file=sys.stderr)
                print(alt.stderr or alt.stdout, file=sys.stderr)
                print(f"SQL applied but failed to record version {version}", file=sys.stderr)
                return 1
        print(f"OK  {path.name}")

    verify = run_psql(
        conn,
        "-tA",
        "-c",
        "select tgname from pg_trigger where tgname in ('document_chunks_require_verified_fact','contracts_require_verified_fact') order by 1;",
    )
    print("Trust triggers:")
    print(verify.stdout.strip() or "(none)")
    return 0 if verify.returncode == 0 else verify.returncode


if __name__ == "__main__":
    raise SystemExit(main())
