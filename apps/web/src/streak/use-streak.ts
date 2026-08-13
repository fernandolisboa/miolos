"use client";

import type { StreakResponse } from "@miolos/core";
import { useEffect, useState } from "react";

import { fetchStreak } from "./streak-client";

/**
 * The mount-time streak read (ADR-0048, plan 027 §8). Three states, each
 * an honest claim:
 *
 * - `undefined` — nothing has settled (unfetched, disabled, or in flight).
 *   Consumers render the zero state / skeleton; server markup and the
 *   pre-hydration paint agree byte-for-byte because the fetch fires in a
 *   mount effect only.
 * - `null` — the fetch SETTLED without a value (env unset, non-200,
 *   network, parse). The conclusion card unmounts to absence on this
 *   (plan 027 D8); the hub reads it as 0 through the same `?.` chain.
 * - a `StreakResponse` — the server's answer.
 *
 * No `localStorage` cache, deliberately (plan 027 D7): a stale server
 * number presented as current is wrong in both directions, while zero is
 * the honest unknown of a value the client can never compute.
 */
export function useStreak(options?: {
  /** `false` keeps the fetch unarmed (the conclusion's closed gate). */
  readonly enabled?: boolean;
  /** A change of identity re-runs the fetch (the conclusion's gate key). */
  readonly refreshKey?: unknown;
}): StreakResponse | null | undefined {
  const enabled = options?.enabled !== false;
  const refreshKey = options?.refreshKey;
  const [value, setValue] = useState<StreakResponse | null | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }
    // The effect-scoped flag makes React 19 strict-mode double effects and
    // out-of-order resolutions harmless: the duplicate GET is idempotent
    // and cheap, and only the live effect's answer lands.
    let cancelled = false;
    void fetchStreak().then((response) => {
      if (!cancelled) {
        setValue(response ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, refreshKey]);

  return value;
}
