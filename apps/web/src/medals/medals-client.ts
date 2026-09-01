import { medalsResponseSchema, type MedalsResponse } from "@miolos/core";

import { apiGet } from "../api/client";

export async function fetchMedals(): Promise<MedalsResponse | undefined> {
  return await apiGet(
    "/medals",
    medalsResponseSchema,
    "medals fetch skipped, the screen keeps the zero state",
  );
}
