#!/usr/bin/env python3
"""Confirm P1 trust objects on live."""
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
print(
    m.psql(
        conn,
        "select tgname from pg_trigger where tgname in ("
        "'awards_require_verified_fact',"
        "'requirements_require_verified_fact',"
        "'pricing_lines_truth_requires_verified_fact',"
        "'document_chunks_require_verified_fact',"
        "'contracts_require_verified_fact'"
        ") order by 1;",
    )
)
print(
    m.psql(
        conn,
        "select polname from pg_policy where polrelid = 'public.document_versions'::regclass order by 1;",
    )
)
print(
    m.psql(
        conn,
        "select version from supabase_migrations.schema_migrations "
        "where version >= '20260821090000' order by 1;",
    )
)
