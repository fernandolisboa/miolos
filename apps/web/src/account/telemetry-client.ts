import { telemetryChoiceSchema } from "@miolos/core";

import { apiGet, apiPostParsed } from "../api/client";

const ABSENCE =
  "telemetry choice skipped, the settings screen shows its neutral fallback";

export async function fetchTelemetrySending(): Promise<boolean | undefined> {
  const choice = await apiGet(
    "/account/telemetry/state",
    telemetryChoiceSchema,
    ABSENCE,
  );
  return choice?.sending;
}

export async function setTelemetrySending(
  sending: boolean,
): Promise<boolean | undefined> {
  const choice = await apiPostParsed(
    "/account/telemetry",
    { sending },
    telemetryChoiceSchema,
    ABSENCE,
  );
  return choice?.sending;
}
