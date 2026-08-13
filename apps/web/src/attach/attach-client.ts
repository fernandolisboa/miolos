import {
  accountDeleteResponseSchema,
  attachConfirmResponseSchema,
  attachRequestResponseSchema,
  attachStateResponseSchema,
  type AttachConfirmResponse,
  type AttachRequest,
  type AttachStateResponse,
} from "@miolos/core";

/**
 * The client half of the attach endpoints (#21, ADR-0050; plan 031 D15) —
 * fetch and parse only, no React, so it is testable without rendering.
 * The completions-client posture throughout: `NEXT_PUBLIC_API_URL`,
 * `credentials: "include"`, an explicit JSON content type on every write
 * (deliberately triggering the CORS preflight, so the WEB_ORIGIN grant is
 * load-bearing), and STRICT parsing of every response body.
 *
 * Failures resolve to `undefined` (the streak-client rule) — except where
 * a specific STATUS is a UI state the plan names: the confirm page renders
 * a different explainer for a dead link (410) than for a conflict (409),
 * and the card words a rate-limit differently from a generic failure, so
 * those statuses come back as string variants rather than being flattened
 * into the same `undefined`.
 *
 * BEHIND THE FREE-PLAY WALL: this module and its siblings are banned from
 * apps/web/src/free-play and app/modo-livre by name (eslint.config.mjs) —
 * free play never touches identity or the streak.
 */

function apiUrl(): string | undefined {
  // Loud, not silent (the session/bootstrap.ts guard): without the var the
  // fetch would hit "undefined/…" and the catch would swallow the
  // misconfiguration forever.
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    console.error(
      "NEXT_PUBLIC_API_URL is unset: attach calls skipped, the prompt stays absent",
    );
    return undefined;
  }
  return url;
}

/** GET /attach/state — a CORS simple request, never preflighted. */
export async function fetchAttachState(): Promise<
  AttachStateResponse | undefined
> {
  const base = apiUrl();
  if (!base) {
    return undefined;
  }
  try {
    const response = await fetch(`${base}/attach/state`, {
      credentials: "include",
    });
    if (!response.ok) {
      return undefined;
    }
    const parsed = attachStateResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export type AttachRequestResult =
  "sent" | "rate-limited" | "already-attached" | undefined;

/** POST /attach/request. The body is the already-validated form value. */
export async function requestAttachLink(
  body: AttachRequest,
): Promise<AttachRequestResult> {
  const base = apiUrl();
  if (!base) {
    return undefined;
  }
  try {
    const response = await fetch(`${base}/attach/request`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.status === 429) {
      return "rate-limited";
    }
    if (response.status === 409) {
      return "already-attached";
    }
    if (!response.ok) {
      return undefined;
    }
    return attachRequestResponseSchema.safeParse(await response.json()).success
      ? "sent"
      : undefined;
  } catch {
    return undefined;
  }
}

export type AttachConfirmResult =
  AttachConfirmResponse | "invalid-or-expired" | "conflict" | undefined;

/** POST /attach/confirm — driven by the /vincular page's explicit click. */
export async function confirmAttach(
  token: string,
): Promise<AttachConfirmResult> {
  const base = apiUrl();
  if (!base) {
    return undefined;
  }
  try {
    const response = await fetch(`${base}/attach/confirm`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (response.status === 410) {
      return "invalid-or-expired";
    }
    if (response.status === 409) {
      return "conflict";
    }
    if (!response.ok) {
      return undefined;
    }
    const parsed = attachConfirmResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** POST /attach/dismiss — the strict empty body; `true` when stamped. */
export async function dismissAttachPrompt(): Promise<boolean> {
  const base = apiUrl();
  if (!base) {
    return false;
  }
  try {
    const response = await fetch(`${base}/attach/dismiss`, {
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

/** POST /account/delete — the literal confirm; `true` when deleted. */
export async function deleteAccount(): Promise<boolean> {
  const base = apiUrl();
  if (!base) {
    return false;
  }
  try {
    const response = await fetch(`${base}/account/delete`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    if (!response.ok) {
      return false;
    }
    return accountDeleteResponseSchema.safeParse(await response.json()).success;
  } catch {
    return false;
  }
}
