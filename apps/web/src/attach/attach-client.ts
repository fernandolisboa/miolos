import {
  accountDeleteResponseSchema,
  attachConfirmResponseSchema,
  attachRequestResponseSchema,
  attachStateResponseSchema,
  type AttachConfirmResponse,
  type AttachRequest,
  type AttachStateResponse,
} from "@miolos/core";

function apiUrl(): string | undefined {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    console.error(
      "NEXT_PUBLIC_API_URL is unset: attach calls skipped, the prompt stays absent",
    );
    return undefined;
  }
  return url;
}

export async function fetchAttachState(): Promise<
  AttachStateResponse | undefined
> {
  const base = apiUrl();
  if (!base) {
    return undefined;
  }
  try {
    const response = await fetch(`${base}/attach/state`, {
      credentials: "include",
    });
    if (!response.ok) {
      return undefined;
    }
    const parsed = attachStateResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export type AttachRequestResult =
  "sent" | "rate-limited" | "already-attached" | undefined;

export async function requestAttachLink(
  body: AttachRequest,
): Promise<AttachRequestResult> {
  const base = apiUrl();
  if (!base) {
    return undefined;
  }
  try {
    const response = await fetch(`${base}/attach/request`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
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
  const base = apiUrl();
  if (!base) {
    return undefined;
  }
  try {
    const response = await fetch(`${base}/attach/confirm`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
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
  const base = apiUrl();
  if (!base) {
    return false;
  }
  try {
    const response = await fetch(`${base}/attach/dismiss`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function deleteAccount(): Promise<boolean> {
  const base = apiUrl();
  if (!base) {
    return false;
  }
  try {
    const response = await fetch(`${base}/account/delete`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    if (!response.ok) {
      return false;
    }
    return accountDeleteResponseSchema.safeParse(await response.json()).success;
  } catch {
    return false;
  }
}
