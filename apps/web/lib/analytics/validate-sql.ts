/**
 * Defensive SQL validator — rejector for any raw SQL string that might reach
 * the analytics path. F6 never executes free LLM SQL; this exists so any
 * accidental rawSql argument fails closed.
 *
 * Rejects: INSERT/UPDATE/DELETE/DROP/DDL, multi-statement, unknown tables,
 * dangerous functions. Allows only single SELECT/WITH against allowlisted tables.
 */

import { ALLOWED_SQL_TABLES } from "@/lib/analytics/semantic-model";

const MUTATION_RE =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY|CALL|EXECUTE|MERGE|REPLACE)\b/i;

const DANGEROUS_FN_RE =
  /\b(pg_sleep|pg_read_file|pg_write_file|lo_import|lo_export|dblink|pg_execute_server_program|set_config|current_setting)\s*\(/i;

const COMMENT_RE = /--|\/\*|\*\//;

export type SqlValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; reason: string };

/**
 * Validate a raw SQL string. Empty / missing → ok (no SQL to reject).
 * Anything else must be a single read-only SELECT/WITH against known tables.
 */
export function validateSql(sql: string | null | undefined): SqlValidationResult {
  if (sql == null || !String(sql).trim()) {
    return { ok: true, normalized: "" };
  }

  const raw = String(sql).trim();

  if (COMMENT_RE.test(raw)) {
    return { ok: false, reason: "SQL comments are not allowed." };
  }

  // Multi-statement: more than one semicolon-terminated statement.
  const withoutTrailing = raw.replace(/;\s*$/, "");
  if (withoutTrailing.includes(";")) {
    return { ok: false, reason: "Multi-statement SQL is not allowed." };
  }

  if (MUTATION_RE.test(raw)) {
    return {
      ok: false,
      reason: "Mutating or DDL SQL (INSERT/UPDATE/DELETE/DROP/…) is rejected.",
    };
  }

  if (DANGEROUS_FN_RE.test(raw)) {
    return { ok: false, reason: "Dangerous SQL functions are rejected." };
  }

  if (!/^\s*(WITH|SELECT)\b/i.test(raw)) {
    return { ok: false, reason: "Only a single SELECT / WITH…SELECT is permitted." };
  }

  // Extract FROM / JOIN table identifiers (simple heuristic).
  const tableRefs = [...raw.matchAll(/\b(?:FROM|JOIN)\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi)].map(
    (m) => m[1]!.toLowerCase(),
  );

  const allowed = new Set(ALLOWED_SQL_TABLES.map((t) => t.toLowerCase()));
  for (const t of tableRefs) {
    if (!allowed.has(t)) {
      return { ok: false, reason: `Unknown or disallowed table "${t}".` };
    }
  }

  return { ok: true, normalized: withoutTrailing };
}

/** Convenience: true when raw SQL must be refused before any execution. */
export function shouldRejectRawSql(sql: string | null | undefined): boolean {
  const v = validateSql(sql);
  return !v.ok;
}
