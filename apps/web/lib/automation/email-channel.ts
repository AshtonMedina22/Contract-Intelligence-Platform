/**
 * Email delivery channel for digests / alerts.
 * Stub returns NOT_CONFIGURED unless Resend/SendGrid env is already present.
 * CatalogIT-style reminder pattern — no Gmail/Slack webhook spam stack.
 */

export type EmailMessage = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

export type EmailSendResult =
  | { ok: true; provider: "resend" | "sendgrid"; id?: string }
  | { ok: false; status: "NOT_CONFIGURED" | "ERROR"; message: string };

export type EmailChannel = {
  send(message: EmailMessage): Promise<EmailSendResult>;
};

function configuredProvider(): "resend" | "sendgrid" | null {
  if (typeof process === "undefined") return null;
  if (process.env.RESEND_API_KEY?.trim()) return "resend";
  if (process.env.SENDGRID_API_KEY?.trim()) return "sendgrid";
  return null;
}

async function sendViaResend(message: EmailMessage): Promise<EmailSendResult> {
  const key = process.env.RESEND_API_KEY!.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "noreply@example.com";
  const to = Array.isArray(message.to) ? message.to : [message.to];
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, status: "ERROR", message: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }
    const json = (await res.json()) as { id?: string };
    return { ok: true, provider: "resend", id: json.id };
  } catch (err) {
    return {
      ok: false,
      status: "ERROR",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function sendViaSendgrid(message: EmailMessage): Promise<EmailSendResult> {
  const key = process.env.SENDGRID_API_KEY!.trim();
  const from = process.env.SENDGRID_FROM_EMAIL?.trim() || "noreply@example.com";
  const to = (Array.isArray(message.to) ? message.to : [message.to]).map((email) => ({ email }));
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to }],
        from: { email: from },
        subject: message.subject,
        content: [
          { type: "text/plain", value: message.text },
          ...(message.html ? [{ type: "text/html", value: message.html }] : []),
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, status: "ERROR", message: `SendGrid ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true, provider: "sendgrid" };
  } catch (err) {
    return {
      ok: false,
      status: "ERROR",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export function createEmailChannel(): EmailChannel {
  return {
    async send(message) {
      const provider = configuredProvider();
      if (!provider) {
        return {
          ok: false,
          status: "NOT_CONFIGURED",
          message:
            "Email channel not configured. Set RESEND_API_KEY or SENDGRID_API_KEY. In-app + digest notifications still work.",
        };
      }
      if (provider === "resend") return sendViaResend(message);
      return sendViaSendgrid(message);
    },
  };
}

/** Convenience for cron routes. */
export async function sendDigestEmail(input: {
  to?: string | string[];
  subject: string;
  text: string;
}): Promise<EmailSendResult> {
  const channel = createEmailChannel();
  const to = input.to ?? process.env.DIGEST_EMAIL_TO?.trim();
  if (!to) {
    return {
      ok: false,
      status: "NOT_CONFIGURED",
      message: "No DIGEST_EMAIL_TO / recipient. Stub only.",
    };
  }
  return channel.send({ to, subject: input.subject, text: input.text });
}
