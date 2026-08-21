/**
 * Per-user in-memory throttle for single-node runtimes (local / one Vercel isolate).
 *
 * LIMITATION (multi-instance): each Node process keeps its own Map. Concurrent instances
 * do not share counters — use Redis / Upstash edge rate limits before multi-region production.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; remaining: 0; resetAt: number; retryAfterSec: number };

export function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + opts.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: opts.limit - 1, resetAt };
  }
  if (existing.count >= opts.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return { ok: false, remaining: 0, resetAt: existing.resetAt, retryAfterSec };
  }
  existing.count += 1;
  return { ok: true, remaining: opts.limit - existing.count, resetAt: existing.resetAt };
}

/** Ask chat: 30 requests / 60s per user. */
export const ASK_CHAT_RATE = { limit: 30, windowMs: 60_000 } as const;

/** Research start/refresh: 10 requests / 60s per user. */
export const RESEARCH_START_RATE = { limit: 10, windowMs: 60_000 } as const;

/** Test helper — clear all buckets. */
export function _resetRateLimitBucketsForTests() {
  buckets.clear();
}
