import { createClient } from "@/lib/supabase/server";
import { buildHealthReport } from "@/lib/ops/health";

/**
 * GET /api/health — ops status booleans only. Never returns secret values.
 * (No `dynamic` segment config — incompatible with cacheComponents.)
 */
export async function GET() {
  let supabaseReachable = false;
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("organizations").select("id").limit(1);
    supabaseReachable = !error;
  } catch {
    supabaseReachable = false;
  }

  const report = buildHealthReport({ supabaseReachable });
  const status = report.ok ? 200 : 503;
  return Response.json(report, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
