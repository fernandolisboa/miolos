"use client";

import type { OnboardingStateResponse } from "@miolos/core";
import { useEffect, useState } from "react";

import { ensureSession } from "../session/bootstrap";
import { fetchOnboardingState } from "./onboarding-client";

/**
 * The mount-time onboarding read (#35, ADR-0061) — the `use-attach-state`
 * shape with ONE departure: it awaits the mint first. Three honest states:
 *
 * - `undefined` — nothing has settled. The card renders nothing, so the
 *   server markup and the pre-hydration paint agree byte-for-byte.
 * - `null` — settled without a value (env unset, non-200, network, parse).
 *   The card stays absent: an unreachable server must never nag.
 * - an `OnboardingStateResponse` — the server's one-boolean answer. The
 *   card renders only on `show: true`; the decision stays server-owned.
 */
export function useOnboardingState():
  OnboardingStateResponse | null | undefined {
  const [value, setValue] = useState<
    OnboardingStateResponse | null | undefined
  >(undefined);

  useEffect(() => {
    // The effect-scoped flag makes React 19 strict-mode double effects and
    // out-of-order resolutions harmless: the duplicate GET is idempotent
    // and cheap, and only the live effect's answer lands.
    let cancelled = false;
    // The mint FIRST (plan 057 §1.3). On a genuinely first visit the user
    // row does not exist until `POST /session` returns, and a bare mount
    // fetch races it into a 401 on the one visit this surface is for.
    // `ensureSession` is the shared fire-once promise `play/sync.ts` and
    // `termo/guess-client.ts` already await (plan 017 §9.2); it never
    // rejects.
    //
    // `ensureSession` resolves whether or not a mint SUCCEEDED — it
    // discards mintSession's boolean. A failed mint (env unset, 5xx,
    // offline) simply reaches the 401 branch, which is the honest absent
    // state. Awaiting it buys ORDERING, never a guarantee of identity.
    // No re-mint on 401: `remintSession`'s one allowance exists for a
    // stale cookie on a WRITE path that would otherwise strand a
    // completion; an introduction card renders nothing instead.
    void ensureSession()
      .then(() => fetchOnboardingState())
      .then((response) => {
        if (!cancelled) {
          setValue(response ?? null);
        }
      })
      // Both callees are verified never to reject, but bootstrap.ts itself
      // treats that invariant as fragile enough to normalize inside
      // `remintSession` — this one line makes the hook self-sufficient:
      // if the invariant ever breaks, the failure direction stays "card
      // absent", never an unhandled rejection (step-6 correctness lens).
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
