#!/usr/bin/env node
/**
 * Apply VERIFY4 promote migration using psql + DATABASE_URL from env.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const migration = join(
  import.meta.dirname,
  "../supabase/migrations/20260820600000_verify4_promote_contract_instruments.sql",
);
const psql = "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe";

// Prefer session/direct port for DDL when using pooler URL.
const direct = url
  .replace(":6543/", ":5432/")
  .replace("?pgbouncer=true&", "?")
  .replace("?pgbouncer=true", "")
  .replace("&pgbouncer=true", "");

for (const target of [direct, url]) {
  const result = spawnSync(psql, [target, "-v", "ON_ERROR_STOP=1", "-f", migration], {
    encoding: "utf8",
    env: process.env,
  });
  console.log(result.stdout || "");
  if (result.stderr) console.error(result.stderr);
  if (result.status === 0) {
    console.log("Migration applied via", target.includes(":5432/") ? "direct:5432" : "pooler");
    process.exit(0);
  }
  console.error("Attempt failed status=", result.status);
}

process.exit(1);
