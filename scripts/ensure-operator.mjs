import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const email = process.env.LP_OPERATOR_EMAIL?.trim();
const password = process.env.LP_OPERATOR_PASSWORD;
const orgName = process.env.LP_OPERATOR_ORG_NAME?.trim() || "L&P Global Security";

if (!url || !publishable || !secret || !email || !password) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL, keys, LP_OPERATOR_EMAIL, LP_OPERATOR_PASSWORD.");
  process.exit(1);
}

const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserId() {
  const perPage = 200;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < perPage) return null;
  }
  return null;
}

async function main() {
  let userId = await findUserId();
  if (!userId) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { platform_role: "global_admin" },
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "createUser failed");
    }
    userId = created.data.user.id;
    console.log("Created operator user.");
  } else {
    const updated = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      app_metadata: { platform_role: "global_admin" },
    });
    if (updated.error) throw new Error(updated.error.message);
    console.log("Updated existing operator password and confirmed email.");
  }

  const { data: memberships, error: membershipError } = await admin
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", userId);
  if (membershipError) throw new Error(membershipError.message);

  if (!memberships?.length) {
    const userClient = createClient(url, publishable, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInError } = await userClient.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(signInError.message);
    const { data: orgId, error: orgError } = await userClient.rpc("create_organization_with_admin", {
      org_name: orgName,
    });
    if (orgError) throw new Error(orgError.message);
    console.log(`Created organization ${orgName} (${orgId}) with admin membership.`);
  } else {
    const adminMembership = memberships.find((row) => row.role === "admin");
    if (!adminMembership) {
      const { error } = await admin
        .from("memberships")
        .update({ role: "admin" })
        .eq("user_id", userId)
        .eq("organization_id", memberships[0].organization_id);
      if (error) throw new Error(error.message);
      console.log("Promoted existing membership to admin.");
    } else {
      console.log(`Operator already admin of ${memberships.length} org(s).`);
    }
  }
}

await main();
