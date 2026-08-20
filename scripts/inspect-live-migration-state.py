#!/usr/bin/env python3
"""Inspect live enums / migration state (no secrets printed)."""
from __future__ import annotations

import os
import subprocess
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PSQL = r"C:\Program Files\PostgreSQL\16\bin\psql.exe"


def load_env() -> dict[str, str]:
    out: dict[str, str] = {}
    for raw in (ROOT / "apps" / "web" / ".env.local").read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        out[key.strip()] = val.strip().strip('"').strip("'")
    return out


def conn_from_url(url: str) -> dict[str, str]:
    u = urllib.parse.urlparse(url)
    return {
        "host": u.hostname or "",
        "port": str(u.port or 5432),
        "user": urllib.parse.unquote(u.username or ""),
        "password": urllib.parse.unquote(u.password or ""),
        "dbname": (u.path or "/postgres").lstrip("/") or "postgres",
    }


def psql(conn: dict[str, str], sql: str) -> str:
    env = os.environ.copy()
    env["PGPASSWORD"] = conn["password"]
    env["PGSSLMODE"] = "require"
    r = subprocess.run(
        [
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
            "-c",
            sql,
        ],
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )
    if r.returncode != 0:
        return f"ERR {r.stderr or r.stdout}"
    return r.stdout


def main() -> None:
    env = load_env()
    conn = conn_from_url(env["DIRECT_URL"])
    print("--- reuse_status labels ---")
    print(
        psql(
            conn,
            "select e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid "
            "where t.typname='reuse_status' order by e.enumsortorder;",
        )
    )
    print("--- applied from 202608206 ---")
    print(
        psql(
            conn,
            "select version from supabase_migrations.schema_migrations "
            "where version >= '20260820600000' order by version;",
        )
    )
    print("--- win_loss lessons column? ---")
    print(
        psql(
            conn,
            "select column_name from information_schema.columns "
            "where table_schema='public' and table_name='win_loss_reviews' "
            "and column_name='lessons_learned';",
        )
    )


if __name__ == "__main__":
    main()
