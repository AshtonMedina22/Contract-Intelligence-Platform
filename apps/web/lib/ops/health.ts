/**
 * Operational health snapshot — booleans / status only. Never include secret values.
 */

export type HealthStatus = "ok" | "degraded" | "unavailable" | "not_configured";

export type HealthReport = {
  ok: boolean;
  checked_at: string;
  supabase: { status: HealthStatus; reachable: boolean };
  processor: { configured: boolean; status: HealthStatus };
  ai_gateway: { configured: boolean; status: HealthStatus };
  ask_model: { configured: boolean; status: HealthStatus };
  ocr: { configured: boolean; status: HealthStatus };
  google: { configured: boolean; status: HealthStatus };
  research_providers: {
    tavily: boolean;
    brave: boolean;
    status: HealthStatus;
  };
};

function present(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export function buildHealthReport(opts?: {
  supabaseReachable?: boolean;
}): HealthReport {
  const supabaseReachable = opts?.supabaseReachable ?? false;
  const processorConfigured =
    present("PROCESSOR_URL") && present("PROCESSOR_SHARED_SECRET");
  const aiGateway = present("AI_GATEWAY_API_KEY");
  const askModel =
    present("ASK_MODEL") ||
    aiGateway ||
    present("GROQ_API_KEY") ||
    present("OLLAMA_BASE_URL") ||
    present("GOOGLE_GENERATIVE_AI_API_KEY") ||
    present("OPENAI_API_KEY");
  const ocr = present("MISTRAL_API_KEY");
  const google =
    present("GOOGLE_DRIVE_ACCESS_TOKEN") || present("GOOGLE_DOCS_ACCESS_TOKEN");
  const tavily = present("TAVILY_API_KEY");
  const brave = present("BRAVE_SEARCH_API_KEY");

  const report: HealthReport = {
    ok: supabaseReachable,
    checked_at: new Date().toISOString(),
    supabase: {
      status: supabaseReachable ? "ok" : "unavailable",
      reachable: supabaseReachable,
    },
    processor: {
      configured: processorConfigured,
      status: processorConfigured ? "ok" : "not_configured",
    },
    ai_gateway: {
      configured: aiGateway,
      status: aiGateway ? "ok" : "not_configured",
    },
    ask_model: {
      configured: askModel,
      status: askModel ? "ok" : "not_configured",
    },
    ocr: {
      configured: ocr,
      status: ocr ? "ok" : "not_configured",
    },
    google: {
      configured: google,
      status: google ? "ok" : "not_configured",
    },
    research_providers: {
      tavily,
      brave,
      status: tavily || brave ? "ok" : "not_configured",
    },
  };
  return report;
}

/** True if a value looks like a secret that must never appear in health JSON. */
export function healthPayloadLooksSecretFree(payload: unknown): boolean {
  const raw = JSON.stringify(payload).toLowerCase();
  const banned = [
    "sb_secret_",
    "service_role",
    "eyj", // JWT prefix
    "sk-",
    "api_key=",
    "password",
    "bearer ",
  ];
  return !banned.some((b) => raw.includes(b));
}
