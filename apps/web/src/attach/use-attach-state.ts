"use client";

import type { AttachStateResponse } from "@miolos/core";
import { useEffect, useState } from "react";

import { fetchAttachState } from "./attach-client";

/**
 * The mount-time attach-eligibility read (#21, D15) — the `use-streak`
 * shape verbatim: a plain mount effect, no options, three honest states.
 *
 * - `undefined` — nothing has settled. The card renders nothing, so the
 *   server markup and the pre-hydration paint agree byte-for-byte.
 * - `null` — the fetch settled without a value (env unset, non-200,
 *   network, parse). The card stays absent: an unreachable server must
 *   never nag.
 * - an `AttachStateResponse` — the server's one-boolean answer (D10). The
 *   card renders only on `eligible: true`; everything behind the boolean
 *   (threshold, email, dismissal, transport) stays server-owned.
 */
export function useAttachState(): AttachStateResponse | null | undefined {
  const [value, setValue] = useState<AttachStateResponse | null | undefined>(
    undefined,
  );

  useEffect(() => {
    // The effect-scoped flag makes React 19 strict-mode double effects and
    // out-of-order resolutions harmless: the duplicate GET is idempotent
    // and cheap, and only the live effect's answer lands.
    let cancelled = false;
    void fetchAttachState().then((response) => {
      if (!cancelled) {
        setValue(response ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return value;
}
