#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DIRECT_URL / DATABASE_URL");
  process.exit(1);
}

const direct = url
  .replace(":6543/", ":5432/")
  .replace("?pgbouncer=true&", "?")
  .replace("?pgbouncer=true", "")
  .replace("&pgbouncer=true", "");

const parsed = new URL(direct);
const psql = "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe";
const migration = join(import.meta.dirname, "../supabase/migrations/20260821240000_f6_analytical_runs.sql");

const env = {
  ...process.env,
  PGHOST: parsed.hostname,
  PGPORT: parsed.port || "5432",
  PGUSER: decodeURIComponent(parsed.username),
  PGPASSWORD: decodeURIComponent(parsed.password),
  PGDATABASE: parsed.pathname.replace(/^\//, ""),
  PGSSLMODE: "require",
};

const result = spawnSync(psql, ["-v", "ON_ERROR_STOP=1", "-f", migration], {
  encoding: "utf8",
  env,
});
console.log(result.stdout || "");
if (result.stderr) console.error(result.stderr);
process.exit(result.status ?? 1);
