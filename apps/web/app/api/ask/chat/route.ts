import { createClient } from "@/lib/supabase/server";
import { streamAskChat } from "@/lib/ask/agent";
import { purposeFromParam, type RetrievalPurpose } from "@/lib/retrieval/purpose";
import type { UIMessage } from "ai";
import { ASK_CHAT_RATE, checkRateLimit } from "@/lib/auth/rate-limit";
import { requirePermission } from "@/lib/auth/permissions";
import { ensureConversation } from "@/lib/ask/conversations";
import {
  latestAssistantAnswer,
  latestUserQuestion,
  persistAiRun,
} from "@/lib/ask/persist-run";
import { sanitizeAuditText } from "@/lib/ask/sanitize-tool-params";

export const maxDuration = 120;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership?.organization_id) {
    return Response.json({ error: "No organization." }, { status: 403 });
  }

  try {
    await requirePermission(supabase, user.id, membership.organization_id, "ask.use");
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Not permitted to use Ask." },
      { status: 403 },
    );
  }

  const limited = checkRateLimit(`ask:${user.id}`, ASK_CHAT_RATE);
  if (!limited.ok) {
    return Response.json(
      {
        error: "Too many Ask requests. Try again shortly.",
        retry_after_sec: limited.retryAfterSec,
        note: "In-memory per-instance throttle; not shared across multi-instance deployments.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  const body = (await req.json()) as {
    messages?: UIMessage[];
    purpose?: string;
    opportunityId?: string | null;
    mode?: string;
    conversationId?: string;
  };

  if (body.mode === "locate" || body.mode === "report") {
    return Response.json(
      { error: "LOCATE and REPORT modes are not streamed via this agent route." },
      { status: 400 },
    );
  }

  const messages = body.messages ?? [];
  if (!messages.length) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const purpose: RetrievalPurpose = purposeFromParam(body.purpose) ?? "GENERAL_QA";
  const opportunityId = body.opportunityId?.trim() || null;
  const conversationId = body.conversationId?.trim() || crypto.randomUUID();
  const dataScope = [
    "organization (RLS)",
    "INTERNAL_VERIFIED + optional PUBLIC research",
    `purpose=${purpose}`,
    opportunityId ? `pursuit=${opportunityId}` : "cross-corpus",
  ].join(" · ");

  try {
    await ensureConversation(supabase, {
      id: conversationId,
      organizationId: membership.organization_id,
      userId: user.id,
      purpose,
      opportunityId,
      messages,
    });
    const stream = await streamAskChat({
      messages,
      purpose,
      opportunityId,
      dataScope,
    });
    return stream.result.toUIMessageStreamResponse({
      originalMessages: messages,
      onFinish: async ({ messages: finishedMessages, isAborted }) => {
        const answer = latestAssistantAnswer(finishedMessages);
        await persistAiRun(supabase, {
          organizationId: membership.organization_id,
          userId: user.id,
          conversationId,
          mode: "ASK_ANALYZE",
          purpose,
          model: stream.modelId,
          question: latestUserQuestion(messages),
          answer,
          latencyMs: Date.now() - stream.startedAtMs,
          status: isAborted
            ? "FAILED"
            : answer === "Insufficient verified evidence to answer this reliably."
              ? "INSUFFICIENT"
              : "SUCCEEDED",
          errorMessage: isAborted ? "Client aborted Ask stream." : null,
          messages: finishedMessages,
          traces: stream.getTraces(),
          evidence: stream.getEvidence(),
        });
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ask stream failed";
    try {
      await persistAiRun(supabase, {
        organizationId: membership.organization_id,
        userId: user.id,
        conversationId,
        mode: "ASK_ANALYZE",
        purpose,
        question: latestUserQuestion(messages),
        status: "FAILED",
        errorMessage: sanitizeAuditText(message),
        messages,
      });
    } catch {
      // The original failure remains the response; persistence failure is not exposed.
    }
    return Response.json({ error: message }, { status: 503 });
  }
}
