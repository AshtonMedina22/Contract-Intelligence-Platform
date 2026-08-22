import { SEMANTIC_SUPPLEMENT_MAX } from "./weights";

export function cosineSimilarity(left: readonly number[], right: readonly number[]): number | null {
  if (!left.length || left.length !== right.length) return null;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (leftNorm === 0 || rightNorm === 0) return null;
  return Math.max(0, Math.min(1, dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))));
}

/** Optional F21 supplement. A missing or invalid semantic score contributes zero, never a fallback guess. */
export function semanticSupplement(similarity: number | null | undefined): number {
  if (similarity == null || !Number.isFinite(similarity)) return 0;
  return Math.round(Math.max(0, Math.min(1, similarity)) * SEMANTIC_SUPPLEMENT_MAX * 100) / 100;
}
