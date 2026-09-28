import {
  accountGoogleResponseSchema,
  accountUnlinkGoogleResponseSchema,
  apiErrorResponseSchema,
  type AccountGoogleResponse,
} from "@miolos/core";

import {
  apiBaseUrl,
  apiGet,
  apiPostRaw,
  parseJsonResponse,
} from "../api/client";

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
  const response = await apiPostRaw(
    "/account/unlink-google",
    { confirm: true },
    ABSENCE,
  );
  if (response?.status === 409) {
    const refusal = await parseJsonResponse(response, apiErrorResponseSchema);
    return refusal?.error === "no-google";
  }
  return (
    response?.ok === true &&
    (await parseJsonResponse(response, accountUnlinkGoogleResponseSchema)) !==
      undefined
  );
}
