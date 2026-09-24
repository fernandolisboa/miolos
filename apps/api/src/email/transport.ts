import type { StreakReminder } from "@miolos/core";

import {
  magicLinkBody,
  magicLinkSubject,
  streakReminderBody,
  streakReminderSubject,
} from "./copy";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const SENDER = "Miolos <conta@miolos.app>";

const REMINDER_UNSUBSCRIBE = "<mailto:privacidade@miolos.app>";

const SEND_TIMEOUT_MS = 10_000;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY) && Boolean(process.env.WEB_ORIGIN);
}

async function postToResend(message: {
  to: string;
  subject: string;
  text: string;
  headers?: Record<string, string>;
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
      from: SENDER,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(message.headers ? { headers: message.headers } : {}),
    }),

    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`email transport: Resend answered ${response.status}`);
  }
}

export async function sendMagicLinkEmail(init: {
  to: string;
  url: string;
}): Promise<void> {
  await postToResend({
    to: init.to,
    subject: magicLinkSubject,
    text: magicLinkBody(init.url),
  });
}

export type ReminderSend = (reminder: StreakReminder) => Promise<boolean>;

export const sendReminderEmail: ReminderSend = async (reminder) => {
  const webOrigin = process.env.WEB_ORIGIN;
  if (!webOrigin) {
    console.error("email transport: WEB_ORIGIN is unset");
    return false;
  }
  try {
    await postToResend({
      to: reminder.to,
      subject: streakReminderSubject,
      text: streakReminderBody(reminder.streak, webOrigin),
      headers: { "List-Unsubscribe": REMINDER_UNSUBSCRIBE },
    });
    return true;
  } catch (thrown) {
    console.error("email transport: reminder not sent", thrown);
    return false;
  }
};
