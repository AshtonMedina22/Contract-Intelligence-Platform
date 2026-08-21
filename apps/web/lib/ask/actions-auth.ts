import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAskTools, type AskToolContext } from "@/lib/ask/tools";
import { purposeFromParam, type RetrievalPurpose } from "@/lib/retrieval/purpose";

/**
 * Auth for ChatGPT Custom GPT Actions:
 * Authorization: Bearer <GPT_ACTIONS_SECRET>
 * Optional operator session cookie also accepted for manual testing.
 */
export async function assertActionsAuth(req: Request): Promise<Response | null> {
  const secret = process.env.GPT_ACTIONS_SECRET?.trim();
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (secret && bearer && bearer === secret) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return null;

  return NextResponse.json(
    { error: "Unauthorized. Use GPT_ACTIONS_SECRET bearer or signed-in operator session." },
    { status: 401 },
  );
}

export function purposeFromRequest(req: Request, body?: { purpose?: string }): RetrievalPurpose {
  const url = new URL(req.url);
  return purposeFromParam(body?.purpose) || purposeFromParam(url.searchParams.get("purpose")) || "GENERAL_QA";
}

export function makeToolContext(purpose: RetrievalPurpose, opportunityId: string | null): AskToolContext {
  return { purpose, opportunityId, evidenceBag: [] };
}

export { createAskTools };
