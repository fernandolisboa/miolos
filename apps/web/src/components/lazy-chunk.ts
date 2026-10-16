"use client";

import { useEffect, useState } from "react";

export type Chunk<T> =
  | { readonly state: "loading" | "failed" }
  | { readonly state: "ready"; readonly value: T };

export function lazyChunk<T>(load: () => Promise<T>) {
  let loaded: Chunk<T> | null = null;
  return function useChunk(retryKey = 0): Chunk<T> {
    const [ready, setReady] = useState(loaded);
    const [failedKey, setFailedKey] = useState<number | null>(null);
    useEffect(() => {
      if (ready !== null) return;
      let live = true;
      load().then(
        (value) => {
          loaded = { state: "ready", value };
          if (live) setReady(loaded);
        },
        () => {
          if (live) setFailedKey(retryKey);
        },
      );
      return () => {
        live = false;
      };
    }, [ready, retryKey]);
    return ready ?? { state: failedKey === retryKey ? "failed" : "loading" };
  };
}
