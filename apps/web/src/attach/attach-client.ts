import {
  accountDeleteResponseSchema,
  attachConfirmResponseSchema,
  attachRequestResponseSchema,
  attachStateResponseSchema,
  type AttachConfirmResponse,
  type AttachRequest,
  type AttachStateResponse,
} from "@miolos/core";

import { apiGet, apiPost, apiPostParsed, apiPostRaw } from "../api/client";

const ABSENCE = "attach calls skipped, the prompt stays absent";

export async function fetchAttachState(): Promise<
  AttachStateResponse | undefined
> {
  return await apiGet("/attach/state", attachStateResponseSchema, ABSENCE);
}

export type AttachRequestResult =
  "sent" | "rate-limited" | "already-attached" | undefined;

export async function requestAttachLink(
  body: AttachRequest,
): Promise<AttachRequestResult> {
  const response = await apiPostRaw("/attach/request", body, ABSENCE);
  if (response === undefined) {
    return undefined;
  }
  try {
    if (response.status === 429) {
      return "rate-limited";
    }
    if (response.status === 409) {
      return "already-attached";
    }
    if (!response.ok) {
      return undefined;
    }
    return attachRequestResponseSchema.safeParse(await response.json()).success
      ? "sent"
      : undefined;
  } catch {
    return undefined;
  }
}

export type AttachConfirmResult =
  AttachConfirmResponse | "invalid-or-expired" | "conflict" | undefined;

export async function confirmAttach(
  token: string,
): Promise<AttachConfirmResult> {
  const response = await apiPostRaw("/attach/confirm", { token }, ABSENCE);
  if (response === undefined) {
    return undefined;
  }
  try {
    if (response.status === 410) {
      return "invalid-or-expired";
    }
    if (response.status === 409) {
      return "conflict";
    }
    if (!response.ok) {
      return undefined;
    }
    const parsed = attachConfirmResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export async function dismissAttachPrompt(): Promise<boolean> {
  return await apiPost("/attach/dismiss", {}, ABSENCE);
}

export async function deleteAccount(): Promise<boolean> {
  const response = await apiPostParsed(
    "/account/delete",
    { confirm: true },
    accountDeleteResponseSchema,
    ABSENCE,
  );
  return response !== undefined;
}
