import {
  notificationsStateResponseSchema,
  type NotificationsStateResponse,
} from "@miolos/core";

function apiUrl(): string | undefined {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    console.error(
      "NEXT_PUBLIC_API_URL is unset: notification calls skipped, the card stays absent",
    );
    return undefined;
  }
  return url;
}

export async function fetchNotificationsState(): Promise<
  NotificationsStateResponse | undefined
> {
  const base = apiUrl();
  if (!base) {
    return undefined;
  }
  try {
    const response = await fetch(`${base}/notifications/state`, {
      credentials: "include",
    });
    if (!response.ok) {
      return undefined;
    }
    const parsed = notificationsStateResponseSchema.safeParse(
      await response.json(),
    );
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export async function postPushSubscription(body: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<boolean> {
  const base = apiUrl();
  if (!base) {
    return false;
  }
  try {
    const response = await fetch(`${base}/push/subscriptions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function dismissPushPrompt(): Promise<boolean> {
  const base = apiUrl();
  if (!base) {
    return false;
  }
  try {
    const response = await fetch(`${base}/notifications/dismiss`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return response.ok;
  } catch {
    return false;
  }
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
