const SECRET_KEY =
  /(^|[_-])(authorization|proxy_authorization|cookie|set_cookie|password|passwd|secret|token|access_token|refresh_token|api_key|apikey|client_secret|private_key)($|[_-])/i;
const SECRET_VALUE =
  /\b(?:bearer|basic)\s+[a-z0-9._~+/=-]+|(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*\S+/gi;

const MAX_DEPTH = 8;
const MAX_STRING = 2_000;
const MAX_ARRAY = 100;
const MAX_KEYS = 100;

function sanitizeString(value: string): string {
  const clipped =
    value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…[truncated]` : value;
  return clipped.replace(SECRET_VALUE, "[REDACTED]");
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth > MAX_DEPTH) return "[MAX_DEPTH]";
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY).map((item) => sanitizeValue(item, depth + 1, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value).slice(0, MAX_KEYS)) {
    output[key] = SECRET_KEY.test(key)
      ? "[REDACTED]"
      : sanitizeValue(nested, depth + 1, seen);
  }
  return output;
}

/** Return JSON-safe tool parameters with credentials and auth material removed. */
export function sanitizeToolParams(value: unknown): Record<string, unknown> {
  const sanitized = sanitizeValue(value, 0, new WeakSet());
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : { value: sanitized };
}

/** Sanitize error text before it enters an audit row. */
export function sanitizeAuditText(value: unknown, maxLength = MAX_STRING): string | null {
  if (value == null) return null;
  const text = value instanceof Error ? value.message : String(value);
  return sanitizeString(text).slice(0, maxLength);
}
