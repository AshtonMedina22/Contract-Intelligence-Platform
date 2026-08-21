/**
 * Env classification for local / CI / ops.
 * Critical missing → exit 1. Optional missing → warn that feature is disabled.
 * Never prints secret values.
 */

const critical = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
];

/** Feature-gated: missing disables a capability; not a hard fail. */
const optionalFeatures = [
  {
    keys: ["PROCESSOR_URL", "PROCESSOR_SHARED_SECRET"],
    feature: "document processor / JobPort fan-out",
  },
  {
    keys: ["ASK_MODEL"],
    feature: "explicit Ask model id (providers may still resolve without it)",
    anyOf: true,
  },
  {
    keys: [
      "AI_GATEWAY_API_KEY",
      "GROQ_API_KEY",
      "OLLAMA_BASE_URL",
      "GOOGLE_GENERATIVE_AI_API_KEY",
      "OPENAI_API_KEY",
    ],
    feature: "Ask / synthesis LLM provider",
    anyOf: true,
  },
  {
    keys: ["MISTRAL_API_KEY"],
    feature: "OCR (scanned PDF path)",
  },
  {
    keys: ["GOOGLE_DRIVE_ACCESS_TOKEN", "GOOGLE_DOCS_ACCESS_TOKEN"],
    feature: "Google Drive intake / Docs proposal sync",
    anyOf: true,
  },
  {
    keys: ["TAVILY_API_KEY", "BRAVE_SEARCH_API_KEY"],
    feature: "public research providers",
    anyOf: true,
  },
  {
    keys: ["RESEND_API_KEY", "SENDGRID_API_KEY"],
    feature: "automation email digest delivery",
    anyOf: true,
  },
  {
    keys: ["GPT_ACTIONS_SECRET"],
    feature: "Custom GPT Actions auth",
  },
];

function present(name) {
  return Boolean(process.env[name]?.trim());
}

const missingCritical = critical.filter((name) => !present(name));

if (missingCritical.length > 0) {
  console.error(`Missing required env: ${missingCritical.join(", ")}`);
  process.exit(1);
}

if (process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY) {
  console.error(
    "SUPABASE_SECRET_KEY must never be exposed as NEXT_PUBLIC_SUPABASE_SECRET_KEY.",
  );
  process.exit(1);
}

if (present("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY") || present("NEXT_PUBLIC_SERVICE_ROLE")) {
  console.error("service_role must never appear under a NEXT_PUBLIC_* name.");
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

const disabled = [];
for (const group of optionalFeatures) {
  const ok = group.anyOf
    ? group.keys.some((k) => present(k))
    : group.keys.every((k) => present(k));
  if (!ok) {
    disabled.push(`${group.feature} (set ${group.keys.join(" + ")})`);
  }
}

console.log("env:check passed (values not printed).");
if (disabled.length > 0) {
  console.log("Optional / feature-gated (missing → feature disabled):");
  for (const line of disabled) {
    console.log(`  - ${line}`);
  }
} else {
  console.log("All known optional feature env groups present.");
}
