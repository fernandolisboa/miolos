import {
  adminStateResponseSchema,
  type AdminStateResponse,
  type RemoteConfigKey,
} from "@miolos/core";

import { apiGet, apiPostParsed } from "../api/client";

const ABSENCE = "admin calls skipped, the admin screen shows its fallback";

export async function fetchAdminState(): Promise<
  AdminStateResponse | undefined
> {
  return await apiGet("/admin/state", adminStateResponseSchema, ABSENCE);
}

export async function saveRemoteConfigValue(
  key: RemoteConfigKey,
  value: number,
): Promise<AdminStateResponse | undefined> {
  return await apiPostParsed(
    "/admin/config",
    { key, value },
    adminStateResponseSchema,
    ABSENCE,
  );
}
