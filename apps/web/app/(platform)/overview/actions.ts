"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({
      status: "read",
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .eq("status", "open");
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/overview");
  return { ok: true as const };
}

export async function markNotificationResolved(notificationId: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: notif, error } = await supabase
    .from("notifications")
    .update({
      status: "resolved",
      resolved_at: now,
      read_at: now,
    })
    .eq("id", notificationId)
    .in("status", ["open", "read"])
    .select("automation_event_id")
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };

  if (notif?.automation_event_id) {
    await supabase
      .from("automation_events")
      .update({
        acknowledged_at: now,
        resolved_at: now,
      })
      .eq("id", notif.automation_event_id)
      .is("resolved_at", null);
  }

  revalidatePath("/overview");
  return { ok: true as const };
}
