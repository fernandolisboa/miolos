"use client";

import type { AttachStateResponse } from "@miolos/core";
import { useEffect, useState } from "react";

import { ensureSession } from "../session/bootstrap";
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
    // THE MINT FIRST (#149, the `use-onboarding-state.ts` ordering). The
    // reasoning "attach needs a streak of 5, so the account is weeks old" is
    // right about a cold first visit and wrong about a RE-MINT LOAD: a
    // returning player whose cookie expired is minted afresh by the layout on
    // that page load, and a bare mount fetch races it into the 401 branch, so
    // the eligible player sees no card at all for that load.
    //
    // `ensureSession` is the shared fire-once promise `play/sync.ts` and
    // `termo/guess-client.ts` already await (plan 017 §9.2); it never rejects,
    // and it resolves whether or not the mint SUCCEEDED. Awaiting it buys
    // ORDERING, never a guarantee of identity — a failed mint simply reaches
    // the 401 branch, which is the honest absent state above. No re-mint on
    // 401: that one allowance exists for a WRITE path that would otherwise
    // strand a completion, and a prompt renders nothing instead.
    void ensureSession()
      .then(() => fetchAttachState())
      .then((response) => {
        if (!cancelled) {
          setValue(response ?? null);
        }
      })
      // Both callees are verified never to reject, but `bootstrap.ts` itself
      // treats that invariant as fragile enough to normalize inside
      // `remintSession` — this keeps the hook self-sufficient: if it ever
      // breaks, the failure direction stays the settled-absent `null`, never
      // an unhandled rejection.
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
