import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Vercel Cron — idempotent application schedule for digests / automation refresh.
 * Supabase pg_cron owns verified date-driven checks; this endpoint triggers a digest summary
 * and optionally re-runs intelligence automation via service role.
 *
 * Never bypasses human verification, final pricing, proposal approval, or submission auth.
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

  const { data: run, error: runError } = await admin.rpc("run_intelligence_automation_service");
  if (runError) {
    console.error("run_intelligence_automation_service", runError.message);
  }

  const { data: orgs } = await admin.from("organizations").select("id").limit(200);
  let digests = 0;
  for (const org of orgs ?? []) {
    const { count } = await admin
      .from("automation_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id)
      .is("acknowledged_at", null);

    const open = count ?? 0;
    if (open === 0) continue;

    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await admin
      .from("automation_events")
      .select("id")
      .eq("organization_id", org.id)
      .eq("kind", "daily_digest")
      .eq("due_on", today)
      .maybeSingle();

    if (existing) continue;

    await admin.from("automation_events").insert({
      organization_id: org.id,
      kind: "daily_digest",
      entity_type: "organization",
      entity_id: null,
      severity: "info",
      title: `Daily intelligence digest — ${open} open alert(s)`,
      detail:
        "Scheduled digest of open automation_events. Humans must act on verification, pricing, proposal approval, and submission. Automation never auto-approves.",
      due_on: today,
      source: "vercel_cron",
    });
    digests += 1;
  }

  return NextResponse.json({
    ok: true,
    digests,
    automationRun: run ?? null,
    automationError: runError?.message ?? null,
    note: "Human gates preserved: verification, pricing, proposal approval, submission",
  });
}
