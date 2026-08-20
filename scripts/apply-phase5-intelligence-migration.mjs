#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const direct = url
  .replace(":6543/", ":5432/")
  .replace("?pgbouncer=true&", "?")
  .replace("?pgbouncer=true", "")
  .replace("&pgbouncer=true", "");

const parsed = new URL(direct);
const psql = "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe";
const migration = join(
  import.meta.dirname,
  "../supabase/migrations/20260820700000_phase5_intelligence_honesty.sql",
);

const env = {
  ...process.env,
  PGHOST: parsed.hostname,
  PGPORT: parsed.port || "5432",
  PGUSER: decodeURIComponent(parsed.username),
  PGPASSWORD: decodeURIComponent(parsed.password),
  PGDATABASE: parsed.pathname.replace(/^\//, ""),
  PGSSLMODE: "require",
};

function run(args, label) {
  console.log("Running", label, args.join(" "));
  const result = spawnSync(psql, args, { encoding: "utf8", env });
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  return result.status ?? 1;
}

const applyStatus = run(["-v", "ON_ERROR_STOP=1", "-f", migration], "apply");
if (applyStatus !== 0) {
  console.error("Apply failed");
  process.exit(applyStatus);
}

const checkStatus = run(
  [
    "-c",
    "select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='reuse_status' order by enumsortorder;",
  ],
  "check enum",
);
const colStatus = run(
  [
    "-c",
    "select column_name from information_schema.columns where table_schema='public' and table_name='win_loss_reviews' and column_name='lessons_learned';",
  ],
  "check lessons_learned",
);

process.exit(checkStatus !== 0 || colStatus !== 0 ? 1 : 0);
