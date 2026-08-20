"use client";

import type { NotificationsStateResponse } from "@miolos/core";
import { useEffect, useState } from "react";

import { ensureSession } from "../session/bootstrap";
import { fetchNotificationsState } from "./push-client";

/**
 * The mount-time notifications read (#145, ADR-0064) — the
 * `use-onboarding-state` shape verbatim, including the mint-first
 * departure. Three honest states:
 *
 * - `undefined` — nothing has settled. The card renders nothing, so the
 *   server markup and the pre-hydration paint agree byte-for-byte.
 * - `null` — settled without a value (env unset, non-200, network, parse).
 *   The card stays absent: an unreachable server must never nag.
 * - a `NotificationsStateResponse` — the server's answer. The card renders
 *   only on `eligible: true` with a non-null key; the eligibility decision
 *   stays server-owned, and the browser-side gates are the card's own.
 */
export function usePushState(): NotificationsStateResponse | null | undefined {
  const [value, setValue] = useState<
    NotificationsStateResponse | null | undefined
  >(undefined);

  useEffect(() => {
    // The effect-scoped flag makes React 19 strict-mode double effects and
    // out-of-order resolutions harmless: the duplicate GET is idempotent
    // and cheap, and only the live effect's answer lands.
    let cancelled = false;
    // The mint FIRST (the use-onboarding-state lesson, plan 057 §1.3): the
    // conclusion is reachable minutes into a first session, but a direct
    // /concluido load can still race the layout's own POST /session into a
    // 401. `ensureSession` is the shared fire-once promise; it never
    // rejects, and awaiting it buys ORDERING, never identity. No re-mint
    // on 401: a prompt card renders nothing instead.
    void ensureSession()
      .then(() => fetchNotificationsState())
      .then((response) => {
        if (!cancelled) {
          setValue(response ?? null);
        }
      })
      // Both callees are verified never to reject; this line makes the
      // hook self-sufficient — if that invariant ever breaks, the failure
      // direction stays "card absent", never an unhandled rejection (the
      // use-onboarding-state step-6 lesson).
      .catch(() => {
        if (!cancelled) {
          setValue(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return value;
}
