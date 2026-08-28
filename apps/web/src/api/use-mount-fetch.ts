"use client";

import { useEffect, useState } from "react";

import { ensureSession } from "../session/bootstrap";

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

    let cancelled = false;

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
