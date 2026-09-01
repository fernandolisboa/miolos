import {
  notificationsStateResponseSchema,
  type NotificationsStateResponse,
} from "@miolos/core";

import { apiGet, apiPost } from "../api/client";

const ABSENCE = "notification calls skipped, the card stays absent";

export async function fetchNotificationsState(): Promise<
  NotificationsStateResponse | undefined
> {
  return await apiGet(
    "/notifications/state",
    notificationsStateResponseSchema,
    ABSENCE,
  );
}

export async function postPushSubscription(body: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<boolean> {
  return await apiPost("/push/subscriptions", body, ABSENCE);
}

export async function dismissPushPrompt(): Promise<boolean> {
  return await apiPost("/notifications/dismiss", {}, ABSENCE);
}

export function applicationServerKeyBytes(
  vapidPublicKey: string,
): Uint8Array<ArrayBuffer> {
  const padded = vapidPublicKey.padEnd(
    vapidPublicKey.length + ((4 - (vapidPublicKey.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded.replaceAll("-", "+").replaceAll("_", "/"));

  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
