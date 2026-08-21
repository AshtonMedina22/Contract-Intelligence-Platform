"use client";

import { useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EvidenceClass, NormalizedEvidence } from "@/lib/ask/evidence";
import { mergeEvidenceBags, sortByAuthority } from "@/lib/ask/evidence";
import type { RetrievalPurpose } from "@/lib/retrieval/purpose";

function storageKey(purpose: string, opportunityId: string | null) {
  return `ask-chat:${purpose}:${opportunityId || "org"}`;
}

const CLASS_ORDER: EvidenceClass[] = [
  "INTERNAL_VERIFIED",
  "OFFICIAL_PUBLIC",
  "EXTERNAL_RESEARCH",
  "AI_INFERENCE",
  "UNVERIFIED",
];

function isEvidenceItem(v: unknown): v is NormalizedEvidence {
  return (
    !!v &&
    typeof v === "object" &&
    "evidence_class" in v &&
    "rail" in v &&
    "id" in v &&
    typeof (v as NormalizedEvidence).id === "string"
  );
}

function extractEvidenceFromMessages(
  messages: { parts?: unknown[] }[],
): NormalizedEvidence[] {
  const bags: NormalizedEvidence[][] = [];
  for (const m of messages) {
    for (const part of m.parts ?? []) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      const type = typeof p.type === "string" ? p.type : "";
      if (!type.startsWith("tool-")) continue;
      const output = (p.output ?? p.result) as Record<string, unknown> | undefined;
      if (!output) continue;
      if (Array.isArray(output.evidence)) {
        bags.push(output.evidence.filter(isEvidenceItem));
      }
      if (isEvidenceItem(output.evidence)) {
        bags.push([output.evidence]);
      }
    }
  }
  return sortByAuthority(mergeEvidenceBags(...bags));
}

function SourceCards({ evidence }: { evidence: NormalizedEvidence[] }) {
  if (!evidence.length) {
    return (
      <p className="text-xs text-muted-foreground">
        No tool evidence yet. Citations appear as [n] after tools run.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {CLASS_ORDER.map((cls) => {
        const items = evidence.filter((e) => e.evidence_class === cls);
        if (!items.length) return null;
        return (
          <div key={cls} className="space-y-1">
            <p className="text-xs font-medium">
              {cls}{" "}
              <span className="font-normal text-muted-foreground">
                ({items[0]?.rail} · auth {items[0]?.source_authority})
              </span>
            </p>
            <ul className="space-y-2">
              {items.map((e, i) => (
                <li key={e.id} className="border-t pt-2 text-xs">
                  <p className="font-medium text-foreground">
                    [{evidence.indexOf(e) + 1}] {e.title}
                  </p>
                  <p className="line-clamp-3 whitespace-pre-wrap text-muted-foreground">{e.excerpt}</p>
                  <p className="mt-1 text-muted-foreground">
                    {e.verification_status}
                    {e.page != null ? ` · page ${e.page}` : ""}
                    {e.url ? (
                      <>
                        {" · "}
                        <a className="underline" href={e.url} target="_blank" rel="noreferrer">
                          open URL
                        </a>
                      </>
                    ) : null}
                    {e.internal_ref ? (
                      <>
                        {" · "}
                        <a className="underline" href={e.internal_ref}>
                          View Source
                        </a>
                      </>
                    ) : null}
                  </p>
                  {i === 0 && cls !== "INTERNAL_VERIFIED" ? (
                    <p className="mt-1 text-amber-700 dark:text-amber-400">
                      Cite-only — not HUMAN_VERIFIED corpus; never invent L&P rates from this.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function AskChatClient(props: {
  purpose: RetrievalPurpose;
  opportunityId: string | null;
  dataScope: string;
  initialQuery?: string;
}) {
  const [input, setInput] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ask/chat",
        body: {
          purpose: props.purpose,
          opportunityId: props.opportunityId,
          mode: "ask",
        },
      }),
    [props.purpose, props.opportunityId],
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({ transport });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey(props.purpose, props.opportunityId));
      if (raw) {
        const parsed = JSON.parse(raw) as typeof messages;
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.purpose, props.opportunityId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        storageKey(props.purpose, props.opportunityId),
        JSON.stringify(messages),
      );
    } catch {
      /* ignore */
    }
  }, [messages, props.purpose, props.opportunityId]);

  useEffect(() => {
    if (props.initialQuery?.trim() && messages.length === 0 && status === "ready") {
      void sendMessage({ text: props.initialQuery.trim() });
    }
    // one-shot seed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const evidence = useMemo(() => extractEvidenceFromMessages(messages), [messages]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || status === "streaming" || status === "submitted") return;
    setInput("");
    await sendMessage({ text });
  }

  return (
    <section className="max-w-3xl space-y-4 border p-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">mode=ask</Badge>
        <Badge variant="outline">purpose={props.purpose}</Badge>
        <Badge variant="outline">dual-rail agent</Badge>
        <Badge variant="outline">status={status}</Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Streaming Ask uses Gateway / Groq / Ollama / optional OpenAI (no Grok). Same tools are available to a
        ChatGPT Custom GPT via Actions. Public research is never equal to INTERNAL_VERIFIED and is never written
        into document_chunks.
      </p>
      <p className="text-xs text-muted-foreground">Scope: {props.dataScope}</p>

      <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-md border bg-muted/20 p-3">
        {messages.length === 0 ? (
          <p className="text-muted-foreground">
            Ask a question grounded in verified L&P evidence (and optional public research).
          </p>
        ) : null}
        {messages.map((m) => (
          <div key={m.id} className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{m.role}</p>
            <div className="whitespace-pre-wrap">
              {m.parts?.map((part, i) => {
                if (part.type === "text") return <span key={i}>{part.text}</span>;
                if (part.type.startsWith("tool-")) {
                  return (
                    <p key={i} className="text-xs text-muted-foreground">
                      Tool: {part.type.replace(/^tool-/, "")}
                    </p>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="text-sm text-red-600">{error.message}</p> : null}

      <form className="flex gap-2" onSubmit={onSubmit}>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask GPT…"
          disabled={status === "streaming" || status === "submitted"}
        />
        <Button type="submit" disabled={status === "streaming" || status === "submitted"}>
          Send
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setMessages([]);
            sessionStorage.removeItem(storageKey(props.purpose, props.opportunityId));
          }}
        >
          Clear
        </Button>
      </form>

      <div className="space-y-2">
        <p className="font-medium">Sources / Evidence</p>
        <SourceCards evidence={evidence} />
        <p className="text-xs text-muted-foreground">
          OpenAPI for ChatGPT Actions: <code>/api/ask/actions/openapi</code>
        </p>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Limitations</p>
        <p>
          Never invent rates/win rates. Public sources are cite-only. LOCATE stays no-LLM; REPORT stays SQL.
          ChatGPT Pro Custom GPT uses the same action endpoints outside this page.
        </p>
      </div>
    </section>
  );
}
