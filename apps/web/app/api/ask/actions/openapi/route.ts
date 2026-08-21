import { NextResponse } from "next/server";
import { GPT_ACTIONS_OPENAPI } from "@/lib/ask/gpt-actions-openapi";

/** Serve OpenAPI for ChatGPT Custom GPT Actions import. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || `${url.protocol}//${url.host}`;
  const schema = {
    ...GPT_ACTIONS_OPENAPI,
    servers: [{ url: origin }],
  };
  return NextResponse.json(schema);
}
