"use client";

import type { AttachStateResponse } from "@miolos/core";

import { useMountFetch } from "../api/use-mount-fetch";
import { fetchAttachState } from "./attach-client";

export function useAttachState(): AttachStateResponse | null | undefined {
  return useMountFetch(fetchAttachState);
}
