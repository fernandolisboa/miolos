import type { StreakReminder } from "@miolos/core";

import {
  magicLinkBody,
  magicLinkSubject,
  streakReminderBody,
  streakReminderSubject,
} from "./copy";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const SENDER = "Miolos <conta@miolos.app>";

const SEND_TIMEOUT_MS = 10_000;

const RATE_LIMIT_WAIT_MS = 1_000;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY) && Boolean(process.env.WEB_ORIGIN);
}

type ResendMessage = {
  to: string;
  subject: string;
  text: string;
  headers?: Record<string, string>;
};

async function requestResend(message: ResendMessage): Promise<number> {
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
      from: SENDER,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(message.headers ? { headers: message.headers } : {}),
    }),

    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  return response.status;
}

export async function sendMagicLinkEmail(init: {
  to: string;
  url: string;
}): Promise<void> {
  const status = await requestResend({
    to: init.to,
    subject: magicLinkSubject,
    text: magicLinkBody(init.url),
  });
  if (status < 200 || status > 299) {
    throw new Error(`email transport: Resend answered ${status}`);
  }
}

export type ReminderSend = (reminder: StreakReminder) => Promise<boolean>;

export const sendReminderEmail: ReminderSend = async (reminder) => {
  const webOrigin = process.env.WEB_ORIGIN;
  if (!webOrigin) {
    console.error("email transport: WEB_ORIGIN is unset");
    return false;
  }
  const message = {
    to: reminder.to,
    subject: streakReminderSubject,
    text: streakReminderBody(reminder.streak, webOrigin),
    headers: { "List-Unsubscribe": `<${webOrigin}/ajustes>` },
  };
  try {
    let status = await requestResend(message);
    if (status === 429) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_WAIT_MS));
      status = await requestResend(message);
    }
    if (status >= 200 && status <= 299) {
      return true;
    }
    console.error(
      `email transport: reminder not sent, Resend answered ${status}`,
    );
  } catch (thrown) {
    console.error("email transport: reminder not sent", thrown);
  }
  return false;
};
