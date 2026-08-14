"use client";

import type { MedalsResponse } from "@miolos/core";
import { useEffect, useState } from "react";

import { fetchMedals } from "./medals-client";

/**
 * The mount-time medals read (#30, the `use-streak.ts` register). A plain
 * mount effect: the one consumer (`MedalsSection` in stats-view.tsx)
 * renders nothing until a value lands, so the hook takes no options.
 * Three states, each an honest claim:
 *
 * - `undefined` — nothing has settled (unfetched or in flight).
 *   The section renders nothing; server markup and the pre-hydration
 *   paint agree byte-for-byte because the fetch fires in a mount effect
 *   only.
 * - `null` — the fetch SETTLED without a value (env unset, non-200,
 *   network, parse). The section renders nothing — the honest absence.
 * - a `MedalsResponse` — the server's answer: the earned id set only
 *   (ADR-0052; no dates, no names — the client owns the copy).
 *
 * No `localStorage` cache, deliberately (ADR-0048 decision 4's posture): a
 * stale server answer presented as current is wrong in both directions,
 * while absence is the honest unknown of a value the client can never
 * compute.
 */
export function useMedals(): MedalsResponse | null | undefined {
  const [value, setValue] = useState<MedalsResponse | null | undefined>(
    undefined,
  );

  useEffect(() => {
    // The effect-scoped flag makes React 19 strict-mode double effects and
    // out-of-order resolutions harmless: the duplicate GET is idempotent
    // and cheap, and only the live effect's answer lands.
    let cancelled = false;
    void fetchMedals().then((response) => {
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
