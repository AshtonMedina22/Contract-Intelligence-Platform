const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
];

const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error(`Missing required env: ${missing.join(", ")}`);
  process.exit(1);
}

if (process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY) {
  console.error(
    "SUPABASE_SECRET_KEY must never be exposed as NEXT_PUBLIC_SUPABASE_SECRET_KEY.",
  );
  process.exit(1);
}

const secret = process.env.SUPABASE_SECRET_KEY ?? "";
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  "";

if (secret.startsWith("sb_publishable_") || publishable.startsWith("sb_secret_")) {
  console.error("Publishable and secret keys appear swapped.");
  process.exit(1);
}

console.log("env:check passed (values not printed).");
