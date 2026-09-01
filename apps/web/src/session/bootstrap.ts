import { sessionResponseSchema } from "@miolos/core";

import { markSessionReady } from "../telemetry/client";

import { apiBaseUrl } from "../api/client";

let pending: Promise<void> | undefined;

let reminting: Promise<boolean> | undefined;
let remintSpent = false;

export function ensureSession(): Promise<void> {
  pending ??= mintSession()
    .then(() => undefined)
    .finally(() => {
      try {
        markSessionReady();
      } catch {
        // A telemetry drain must never reach the session contract.
      }
    });
  return pending;
}

export function remintSession(): Promise<boolean> {
  if (reminting !== undefined) {
    return reminting;
  }
  if (remintSpent) {
    return Promise.resolve(false);
  }
  remintSpent = true;
  const attempt = mintSession()
    .catch(() => false)
    .then((minted) => {
      reminting = undefined;
      if (!minted) {
        remintSpent = false;
      }
      return minted;
    });
  reminting = attempt;

  pending = attempt.then(() => undefined);
  return attempt;
}

export function confirmSession(): void {
  remintSpent = false;
}

async function mintSession(): Promise<boolean> {
  const apiUrl = apiBaseUrl(
    "session bootstrap skipped, no identity will be minted",
  );
  if (!apiUrl) {
    return false;
  }
  try {
    const response = await fetch(`${apiUrl}/session`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      return false;
    }

    try {
      sessionResponseSchema.parse(await response.json());
    } catch {
      console.error(
        "POST /session answered 200 with a body the session contract refuses; the cookie is honoured, the contract has drifted",
      );
    }
    return true;
  } catch {
    return false;
  }
}
