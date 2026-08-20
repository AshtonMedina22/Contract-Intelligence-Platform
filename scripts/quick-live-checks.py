#!/usr/bin/env python3
"""Quick live object checks (no secrets)."""
from __future__ import annotations

import importlib.util
from pathlib import Path

p = Path(__file__).with_name("inspect-live-migration-state.py")
spec = importlib.util.spec_from_file_location("insp", p)
m = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(m)

env = m.load_env()
conn = m.conn_from_url(env["DIRECT_URL"])

checks = [
    "select typname from pg_type where typname='retrieval_purpose';",
    "select to_regclass('public.automation_events');",
    "select to_regprocedure('public.search_verified_knowledge(text, public.vector, boolean, integer, uuid, public.retrieval_purpose)');",
    "select to_regclass('public.pricing_comparable_judgments');",
    "select to_regprocedure('private.refresh_approval_reminder_alerts()');",
    "select tgname from pg_trigger where tgname like '%require_verified%';",
    "select version from supabase_migrations.schema_migrations where version >= '20260820700000' order by 1;",
]
for sql in checks:
    print("---", sql[:70], "---")
    print(m.psql(conn, sql))
