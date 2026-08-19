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

  const { error } = await supabase.rpc("create_organization_with_admin", {
    org_name: name,
  });

  if (error) {
    fail(error.message);
  }

  revalidatePath("/system/settings");
  redirect("/system/settings");
}
