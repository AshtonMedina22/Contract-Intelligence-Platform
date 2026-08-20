/** Display label for chunk reuse — maps legacy REVIEW if present. */
export function formatReuseStatus(status: string): string {
  if (status === "REVIEW") return "REVIEW_REQUIRED";
  return status;
}
