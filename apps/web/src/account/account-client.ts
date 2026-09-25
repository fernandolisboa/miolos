import {
  accountDetachEmailResponseSchema,
  accountStateResponseSchema,
  reminderConsentResponseSchema,
  type AccountStateResponse,
} from "@miolos/core";

import { apiGet, apiPostParsed } from "../api/client";

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
  const response = await apiPostParsed(
    "/account/detach-email",
    { confirm: true },
    accountDetachEmailResponseSchema,
    ABSENCE,
  );
  return response !== undefined;
}
