"use client";

import { useEffect, useState } from "react";

import { ensureSession } from "../session/bootstrap";

/**
 * The one mount-time authenticated read. Three honest states: `undefined`
 * nothing has settled, `null` the read SETTLED without a value (env unset,
 * non-200, network, parse), or the server's answer.
 *
 * `enabled` must be a MODULE-LEVEL predicate: it is evaluated inside the
 * effect, so the SSR paint is unaffected, but an inline closure is a fresh
 * value per render and would re-run the effect on every settle. Same for
 * `fetcher` — `T-WEB-S352` scans the call sites for both.
 */
export function useMountFetch<T>(
  fetcher: () => Promise<T | undefined>,
  enabled?: () => boolean,
): T | null | undefined {
  const [value, setValue] = useState<T | null | undefined>(undefined);

  useEffect(() => {
    if (enabled !== undefined && !enabled()) {
      return;
    }
    // The effect-scoped flag makes React 19 strict-mode double effects and
    // out-of-order resolutions harmless: the duplicate GET is idempotent
    // and cheap, and only the live effect's answer lands.
    let cancelled = false;
    // THE MINT FIRST — see ADR-0072's Context: on a re-mint load a bare
    // mount fetch races `POST /session` into the 401 branch and the surface
    // reads empty for that whole load. Awaiting buys ORDERING, never
    // identity; a failed mint reaches the same honest `null`. And no
    // re-mint on the 401 either: `remintSession`'s one allowance per page
    // load exists for a WRITE that would otherwise strand a completion, and
    // spending it on a read would leave that write without one.
    void ensureSession()
      .then(() => fetcher())
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
  }, [fetcher, enabled]);

  return value;
}
