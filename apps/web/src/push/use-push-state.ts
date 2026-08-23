"use client";

import type { NotificationsStateResponse } from "@miolos/core";

import { useMountFetch } from "../api/use-mount-fetch";
import { fetchNotificationsState } from "./push-client";

/**
 * `enabled` is REQUIRED here (ADR-0064): the caller's free synchronous
 * browser gates — the triple feature detect, `Notification.permission ===
 * "default"` — each conclusively prove the card can never render on this
 * browser, so the credentialed GET, which runs the account's full streak
 * read server-side, fires only when they pass.
 */
export function usePushState(
  enabled: () => boolean,
): NotificationsStateResponse | null | undefined {
  return useMountFetch(fetchNotificationsState, enabled);
}
