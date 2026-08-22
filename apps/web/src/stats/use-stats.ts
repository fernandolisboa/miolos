"use client";

import type { StatsResponse } from "@miolos/core";
import { useEffect, useState } from "react";

import { ensureSession } from "../session/bootstrap";
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
    // THE MINT FIRST (#149) — the ordering and its full reasoning are in
    // `attach/use-attach-state.ts`. On a re-mint load the 401 branch renders
    // real aggregates as zeros, which is the same wrong-in-both-directions
    // failure the no-cache decision above exists to avoid. Awaiting buys
    // ORDERING, never identity.
    void ensureSession()
      .then(() => fetchStats())
      .then((response) => {
        if (!cancelled) {
          setValue(response ?? null);
        }
      })
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
