"use client";

import type { NotificationsStateResponse } from "@miolos/core";

import { useMountFetch } from "../api/use-mount-fetch";
import { fetchNotificationsState } from "./push-client";

export function usePushState(
  enabled: () => boolean,
): NotificationsStateResponse | null | undefined {
  return useMountFetch(fetchNotificationsState, enabled);
}
