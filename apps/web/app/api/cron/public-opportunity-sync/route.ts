import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runAllEnabledProfileSyncs } from "@/lib/procurement/sync/run-profile-sync";

/**
 * Vercel Cron — runs enabled opportunity_search_profiles against PublicProcurementProvider.search
 * and upserts public_sources for live provider hits only. Fixture/sample mode is skipped
 * (fail closed). Never invents notices. Does not mark HUMAN_VERIFIED.
 *
 * Secured like other crons: when CRON_SECRET is set, Authorization must be Bearer <secret>.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: "missing supabase env" }, { status: 500 });
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { profiles, results } = await runAllEnabledProfileSyncs(admin, { maxProfiles: 50 });
    const upserted = results.reduce((sum, r) => sum + r.upserted, 0);
    const errors = results.flatMap((r) => r.errors);
    return NextResponse.json({
      ok: errors.length === 0,
      profiles,
      upserted,
      errors: errors.length > 0 ? errors.slice(0, 20) : null,
      note: "Public sync upserts provider hits only — never invents notices; never HUMAN_VERIFIED.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "public opportunity sync failed",
      },
      { status: 500 },
    );
  }
}
