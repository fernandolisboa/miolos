import { magicLinkBody, magicLinkSubject } from "./copy";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const MAGIC_LINK_SENDER = "Miolos <conta@miolos.app>";

const SEND_TIMEOUT_MS = 10_000;

export function isAttachConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY) && Boolean(process.env.WEB_ORIGIN);
}

export async function sendMagicLinkEmail(init: {
  to: string;
  url: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("email transport: RESEND_API_KEY is unset");
  }
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: MAGIC_LINK_SENDER,
      to: [init.to],
      subject: magicLinkSubject,
      text: magicLinkBody(init.url),
    }),

    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`email transport: Resend answered ${response.status}`);
  }
}
