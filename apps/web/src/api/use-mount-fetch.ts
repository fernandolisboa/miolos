"use client";

import { useEffect, useState } from "react";

import { ensureSession } from "../session/bootstrap";

/**
 * The one mount-time authenticated read. Three honest states: `undefined`
 * nothing has settled, `null` the read SETTLED without a value (env unset,
 * non-200, network, parse), or the server's answer.
 *
 * Both arguments are FROZEN AT MOUNT, and that is the whole safety argument.
 * The seven hooks this replaces each hard-coded `[]`, so no caller could make
 * them refetch. Depending on `[fetcher, enabled]` instead would hand that
 * property to every call site: a per-render closure re-runs the effect,
 * `setValue` re-renders, and the credentialed GET loops without bound.
 * `exhaustive-deps` cannot see it, because inside this hook the deps are
 * correct. Freezing restores the guarantee for every possible caller rather
 * than policing how they spell the arguments.
 */
export function useMountFetch<T>(
  fetcher: () => Promise<T | undefined>,
  enabled?: () => boolean,
): T | null | undefined {
  const [value, setValue] = useState<T | null | undefined>(undefined);
  const [mountArgs] = useState(() => ({ fetcher, enabled }));

  useEffect(() => {
    const { fetcher: read, enabled: gate } = mountArgs;
    if (gate !== undefined && !gate()) {
      return;
    }
    // The effect-scoped flag makes React 19 strict-mode double effects and
    // out-of-order resolutions harmless: the duplicate GET is idempotent
    // and cheap, and only the live effect's answer lands.
    let cancelled = false;
    // The mint goes first — see ADR-0072's Context. No re-mint on a 401:
    // see ADR-0072 consequence (g).
    void ensureSession()
      .then(() => read())
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
  }, [mountArgs]);

  return value;
}
