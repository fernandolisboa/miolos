"use client";

import { useEffect, useState } from "react";

export function lazyChunk(load: () => Promise<void>) {
  let done = false;
  return function useChunkLoaded(retryKey?: unknown): boolean {
    const [loaded, setLoaded] = useState(done);
    useEffect(() => {
      if (loaded) return;
      let live = true;
      load().then(
        () => {
          done = true;
          if (live) setLoaded(true);
        },
        () => undefined,
      );
      return () => {
        live = false;
      };
    }, [loaded, retryKey]);
    return loaded;
  };
}
