import { dayResponseSchema, type DayResponse } from "@miolos/core";

import { apiGet } from "../api/client";

export async function fetchDayTruth(): Promise<DayResponse | undefined> {
  return await apiGet(
    "/day",
    dayResponseSchema,
    "day fetch skipped, the hub keeps this device's own day state",
  );
}
