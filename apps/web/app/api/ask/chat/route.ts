import { createClient } from "@/lib/supabase/server";
import { streamAskChat } from "@/lib/ask/agent";
import { purposeFromParam, type RetrievalPurpose } from "@/lib/retrieval/purpose";
import type { UIMessage } from "ai";

export const maxDuration = 120;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    messages?: UIMessage[];
    purpose?: string;
    opportunityId?: string | null;
    mode?: string;
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
  const dataScope = [
    "organization (RLS)",
    "INTERNAL_VERIFIED + optional PUBLIC research",
    `purpose=${purpose}`,
    opportunityId ? `pursuit=${opportunityId}` : "cross-corpus",
  ].join(" · ");

  try {
    const { result } = await streamAskChat({
      messages,
      purpose,
      opportunityId,
      dataScope,
    });
    return result.toUIMessageStreamResponse();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ask stream failed";
    return Response.json({ error: message }, { status: 503 });
  }
}
