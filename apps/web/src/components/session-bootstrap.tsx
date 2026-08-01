"use client";

import { useEffect } from "react";

import { ensureSession } from "../session/bootstrap";

/**
 * Fire-once anonymous-identity bootstrap (issue #15). Renders nothing; on
 * first mount it POSTs to the api so the very first visit mints a user with
 * zero interaction and every later visit slides the session window.
 *
 * The fire-once guard and the request itself live in
 * `src/session/bootstrap.ts` because the completion flush awaits the same
 * mint (plan 017 §9.2); this component is now only the mount trigger.
 */
export function SessionBootstrap() {
  useEffect(() => {
    void ensureSession();
  }, []);
  return null;
}
