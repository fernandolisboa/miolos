"use client";

import { useEffect, useState } from "react";

export type ChunkState = "loading" | "ready" | "failed";

export function lazyChunk(load: () => Promise<void>) {
  let done = false;
  return function useChunk(retryKey?: unknown): ChunkState {
    const [ready, setReady] = useState(done);
    const [failed, setFailed] = useState<{ readonly key: unknown } | null>(
      null,
    );
    useEffect(() => {
      if (ready) return;
      let live = true;
      load().then(
        () => {
          done = true;
          if (live) setReady(true);
        },
        () => {
          if (live) setFailed({ key: retryKey });
        },
      );
      return () => {
        live = false;
      };
    }, [ready, retryKey]);
    if (ready) return "ready";
    return failed !== null && Object.is(failed.key, retryKey)
      ? "failed"
      : "loading";
  };
}
