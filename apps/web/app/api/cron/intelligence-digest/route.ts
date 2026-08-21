import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildDailyDigestPayload, type DigestEvent } from "@/lib/automation/digest";
import { sendDigestEmail } from "@/lib/automation/email-channel";

/**
 * Vercel Cron — existing path /api/cron/intelligence-digest (no second cron).
 * Calls run_intelligence_automation_service, builds richer digest buckets, stubs email,
 * mirrors digest notifications. Never bypasses human gates.
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

  const today = new Date().toISOString().slice(0, 10);
  const { data: orgs } = await admin.from("organizations").select("id").limit(200);
  let digests = 0;
  let notificationsMirrored = 0;
  const emailResults: Array<{ organization_id: string; status: string }> = [];

  for (const org of orgs ?? []) {
    const { data: openEvents } = await admin
      .from("automation_events")
      .select("id, kind, title, detail, due_on, severity, deep_link, organization_id")
      .eq("organization_id", org.id)
      .is("acknowledged_at", null)
      .is("resolved_at", null)
      .neq("kind", "daily_digest");

    const events = (openEvents ?? []) as DigestEvent[];
    if (events.length === 0) continue;

    const payload = buildDailyDigestPayload({
      organizationId: org.id,
      events,
      todayIso: today,
    });

    const { data: existing } = await admin
      .from("automation_events")
      .select("id")
      .eq("organization_id", org.id)
      .eq("kind", "daily_digest")
      .eq("due_on", today)
      .maybeSingle();

    if (!existing) {
      const detail = [
        `overdue=${payload.counts.overdue}`,
        `today=${payload.counts.today}`,
        `next_7=${payload.counts.next_7}`,
        `next_30=${payload.counts.next_30}`,
        `undated=${payload.counts.undated}`,
        "Humans must act on verification, pricing, proposal approval, and submission. Automation never auto-approves.",
      ].join("; ");

      const { data: digestEvent } = await admin
        .from("automation_events")
        .insert({
          organization_id: org.id,
          kind: "daily_digest",
          entity_type: "organization",
          entity_id: null,
          severity: "info",
          title: `Daily intelligence digest — ${payload.open_total} open alert(s)`,
          detail,
          due_on: today,
          source: "vercel_cron",
          dedupe_key: `daily_digest:${org.id}:${today}`,
          deep_link: "/overview",
          first_triggered_at: new Date().toISOString(),
          last_triggered_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      digests += 1;

      const digestDedupe = `digest:${org.id}:${today}`;
      const { data: existingNotif } = await admin
        .from("notifications")
        .select("id")
        .eq("organization_id", org.id)
        .eq("channel", "digest")
        .eq("dedupe_key", digestDedupe)
        .eq("status", "open")
        .maybeSingle();

      if (!existingNotif) {
        await admin.from("notifications").insert({
          organization_id: org.id,
          user_id: null,
          automation_event_id: digestEvent?.id ?? null,
          channel: "digest",
          title: `Daily digest — ${payload.open_total} open`,
          body: detail,
          deep_link: "/overview",
          severity: "info",
          status: "open",
          dedupe_key: digestDedupe,
        });
        notificationsMirrored += 1;
      }
    }

    const emailText = [
      `Daily intelligence digest for org ${org.id}`,
      `As of ${payload.as_of}`,
      `Open: ${payload.open_total}`,
      `Overdue: ${payload.counts.overdue}`,
      `Today: ${payload.counts.today}`,
      `Next 7: ${payload.counts.next_7}`,
      `Next 30: ${payload.counts.next_30}`,
      "",
      payload.note,
    ].join("\n");

    const emailResult = await sendDigestEmail({
      subject: `L&P intelligence digest — ${payload.open_total} open`,
      text: emailText,
    });
    emailResults.push({
      organization_id: org.id,
      status: emailResult.ok ? emailResult.provider : emailResult.status,
    });
  }

  return NextResponse.json({
    ok: true,
    digests,
    notificationsMirrored,
    emailResults,
    automationRun: run ?? null,
    automationError: runError?.message ?? null,
    note: "Human gates preserved: verification, pricing, proposal approval, submission, renew, option exercise",
  });
}
