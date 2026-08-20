import {
  notificationsStateResponseSchema,
  type NotificationsStateResponse,
} from "@miolos/core";

/**
 * The client half of the notification endpoints (#145, ADR-0064) — fetch
 * and parse only, no React, so it is testable without rendering. The
 * onboarding-client posture throughout: `NEXT_PUBLIC_API_URL`,
 * `credentials: "include"`, an explicit JSON content type on every write
 * (deliberately triggering the CORS preflight, so the WEB_ORIGIN grant is
 * load-bearing), and STRICT parsing of the read's response body.
 *
 * Failures resolve to `undefined`/`false` (the streak-client rule): an
 * unreachable server must never nag, so the card simply stays absent on
 * that visit and appears on the next one.
 *
 * BEHIND THE FREE-PLAY WALL: this module and its siblings are banned from
 * apps/web/src/free-play and app/modo-livre by name (eslint.config.mjs) —
 * free play never touches identity or the push opt-in.
 *
 * No DELETE client ships in this slice, deliberately: the route exists as
 * #36's settings-toggle seam, and a client function with no caller is the
 * dormant surface this repo treats as a finding.
 */

function apiUrl(): string | undefined {
  // Loud, not silent (the session/bootstrap.ts guard): without the var the
  // fetch would hit "undefined/…" and the catch would swallow the
  // misconfiguration forever.
  //
  // DELIBERATELY the third literal copy of this guard (#145 step-6
  // quality 1), beside attach-client.ts and onboarding-client.ts: the
  // free-play wall bans these client modules BY NAME, so a shared
  // src/api/api-url.ts would itself need a wall entry and become one more
  // module every future client must remember to route through — the copy
  // keeps each client self-contained behind its own wall entry. The day a
  // fourth copy arrives is the day to extract (the site-origin.ts rule).
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    console.error(
      "NEXT_PUBLIC_API_URL is unset: notification calls skipped, the card stays absent",
    );
    return undefined;
  }
  return url;
}

/** GET /notifications/state — a CORS simple request, never preflighted. */
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

/** POST /push/subscriptions — the browser's subscription; `true` when stored. */
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

/** POST /notifications/dismiss — the strict empty body; `true` when stamped. */
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

/**
 * base64url → the `Uint8Array` `pushManager.subscribe` wants for
 * `applicationServerKey` (hand-rolled per the repo's transport posture —
 * RFC 8291's COMPOSITION crypto is #146's `web-push` exception; a base64url
 * decode is not crypto). The VAPID public key arrives base64url-encoded
 * and unpadded from the state endpoint.
 */
export function applicationServerKeyBytes(
  vapidPublicKey: string,
): Uint8Array<ArrayBuffer> {
  const padded = vapidPublicKey.padEnd(
    vapidPublicKey.length + ((4 - (vapidPublicKey.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded.replaceAll("-", "+").replaceAll("_", "/"));
  // Built over an explicit ArrayBuffer: `subscribe`'s BufferSource is typed
  // over ArrayBuffer, and `Uint8Array.from` infers the wider
  // ArrayBufferLike, which strict TS rejects at the call site.
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
