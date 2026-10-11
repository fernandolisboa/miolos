import {
  accountGoogleResponseSchema,
  accountUnlinkGoogleResponseSchema,
  type AccountGoogleResponse,
} from "@miolos/core";

import { apiBaseUrl, apiConfirm, apiGet } from "../api/client";

const ABSENCE =
  "Google calls skipped, the settings screen hides the Google card";

export async function fetchGoogleState(): Promise<
  AccountGoogleResponse["google"] | undefined
> {
  const response = await apiGet(
    "/account/google",
    accountGoogleResponseSchema,
    ABSENCE,
  );
  return response?.google;
}

export function googleStartUrl(): string | undefined {
  const base = apiBaseUrl(ABSENCE);
  return base === undefined ? undefined : `${base}/auth/google/start`;
}

export async function unlinkGoogle(): Promise<boolean> {
  return await apiConfirm(
    "/account/unlink-google",
    accountUnlinkGoogleResponseSchema,
    "no-google",
    ABSENCE,
  );
}
