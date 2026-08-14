"use client";

import type { StatsResponse } from "@miolos/core";
import { useEffect, useState } from "react";

import { fetchStats } from "./stats-client";

/**
 * The mount-time stats read (#29, the `use-streak.ts` register). A plain
 * mount effect: consumers that need a gate mount the consuming component
 * conditionally (the hub's `TermoDoneLink` and the conclusion's stat block
 * do exactly that), so the hook takes no options. Three states, each an
 * honest claim:
 *
 * - `undefined` — nothing has settled (unfetched or in flight).
 *   Consumers render the zero state / skeleton; server markup and the
 *   pre-hydration paint agree byte-for-byte because the fetch fires in a
 *   mount effect only.
 * - `null` — the fetch SETTLED without a value (env unset, non-200,
 *   network, parse). Consumers render the honest absence or real zeros.
 * - a `StatsResponse` — the server's answer.
 *
 * No `localStorage` cache, deliberately (ADR-0048 decision 4's posture): a
 * stale server aggregate presented as current is wrong in both directions,
 * while zero is the honest unknown of a value the client can never compute.
 */
export function useStats(): StatsResponse | null | undefined {
  const [value, setValue] = useState<StatsResponse | null | undefined>(
    undefined,
  );

  useEffect(() => {
    // The effect-scoped flag makes React 19 strict-mode double effects and
    // out-of-order resolutions harmless: the duplicate GET is idempotent
    // and cheap, and only the live effect's answer lands.
    let cancelled = false;
    void fetchStats().then((response) => {
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
