import {
  accountDetachEmailResponseSchema,
  accountStateResponseSchema,
  apiErrorResponseSchema,
  reminderConsentResponseSchema,
  type AccountStateResponse,
} from "@miolos/core";

import {
  apiGet,
  apiPostParsed,
  apiPostRaw,
  parseJsonResponse,
} from "../api/client";

const ABSENCE =
  "account calls skipped, the settings screen shows its neutral fallback";

export async function fetchAccountState(): Promise<
  AccountStateResponse | undefined
> {
  return await apiGet("/account/state", accountStateResponseSchema, ABSENCE);
}

export async function setReminderConsent(
  granted: boolean,
): Promise<boolean | undefined> {
  const response = await apiPostParsed(
    "/account/reminder-consent",
    { granted },
    reminderConsentResponseSchema,
    ABSENCE,
  );
  return response?.reminderConsent;
}

export async function detachAccountEmail(): Promise<boolean> {
  const response = await apiPostRaw(
    "/account/detach-email",
    { confirm: true },
    ABSENCE,
  );
  if (response?.status === 409) {
    const refusal = await parseJsonResponse(response, apiErrorResponseSchema);
    return refusal?.error === "no-email";
  }
  return (
    response?.ok === true &&
    (await parseJsonResponse(response, accountDetachEmailResponseSchema)) !==
      undefined
  );
}
