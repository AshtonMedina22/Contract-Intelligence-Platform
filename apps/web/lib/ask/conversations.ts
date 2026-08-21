import type { UIMessage } from "ai";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AskConversationSummary = {
  id: string;
  title: string;
  purpose: string;
  opportunity_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PersistedAskMessage = {
  id: string;
  client_message_id: string | null;
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  parts: unknown;
  sequence: number;
  created_at: string;
};

function titleFromMessages(messages: UIMessage[]): string {
  const firstUser = messages.find((message) => message.role === "user");
  const text = firstUser?.parts
    ?.filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
  return text ? text.slice(0, 96) : "New conversation";
}

export async function ensureConversation(
  supabase: Supabase,
  opts: {
    id: string;
    organizationId: string;
    userId: string;
    purpose: string;
    opportunityId: string | null;
    messages: UIMessage[];
  },
): Promise<AskConversationSummary> {
  const { data: existing, error: readError } = await supabase
    .from("ask_conversations")
    .select("id, title, purpose, opportunity_id, created_at, updated_at")
    .eq("id", opts.id)
    .maybeSingle();
  if (readError) throw new Error(`Unable to read Ask conversation: ${readError.message}`);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("ask_conversations")
    .insert({
      id: opts.id,
      organization_id: opts.organizationId,
      created_by: opts.userId,
      title: titleFromMessages(opts.messages),
      purpose: opts.purpose,
      opportunity_id: opts.opportunityId,
    })
    .select("id, title, purpose, opportunity_id, created_at, updated_at")
    .single();
  if (error || !data) throw new Error(`Unable to create Ask conversation: ${error?.message}`);
  return data;
}

export async function listConversations(
  supabase: Supabase,
  limit = 30,
): Promise<AskConversationSummary[]> {
  const { data, error } = await supabase
    .from("ask_conversations")
    .select("id, title, purpose, opportunity_id, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Unable to list Ask conversations: ${error.message}`);
  return data ?? [];
}

export async function loadConversationMessages(
  supabase: Supabase,
  conversationId: string,
): Promise<PersistedAskMessage[]> {
  const { data, error } = await supabase
    .from("ask_messages")
    .select("id, client_message_id, role, content, parts, sequence, created_at")
    .eq("conversation_id", conversationId)
    .order("sequence", { ascending: true });
  if (error) throw new Error(`Unable to load Ask messages: ${error.message}`);
  return data ?? [];
}

export function persistedMessagesToUi(messages: PersistedAskMessage[]): UIMessage[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      id: message.client_message_id ?? message.id,
      role: message.role as "user" | "assistant",
      parts: Array.isArray(message.parts)
        ? (message.parts as UIMessage["parts"])
        : message.content
          ? [{ type: "text" as const, text: message.content }]
          : [],
    }));
}
