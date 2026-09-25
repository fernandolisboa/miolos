import {
  accountStateResponseSchema,
  type AccountStateResponse,
} from "@miolos/core";

import { apiGet } from "../api/client";

export async function fetchAccountState(): Promise<
  AccountStateResponse | undefined
> {
  return await apiGet(
    "/account/state",
    accountStateResponseSchema,
    "account fetch skipped, the settings screen shows its neutral fallback",
  );
}
