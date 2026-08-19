"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function fail(message: string): never {
  redirect(`/system/settings?error=${encodeURIComponent(message)}`);
}

export async function createOrganization(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    fail("Organization name is required.");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    fail("You must be signed in.");
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name })
    .select("id")
    .single();

  if (orgError || !org) {
    fail(orgError?.message ?? "Could not create organization.");
  }

  const { error: memberError } = await supabase.from("memberships").insert({
    organization_id: org.id,
    user_id: user.id,
    role: "admin",
  });

  if (memberError) {
    fail(memberError.message);
  }

  revalidatePath("/system/settings");
  redirect("/system/settings");
}
