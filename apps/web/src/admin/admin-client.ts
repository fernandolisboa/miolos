import {
  adminStateResponseSchema,
  type AdminMemberRole,
  type AdminStateResponse,
  type RemoteConfigKey,
} from "@miolos/core";

import { apiDeleteParsed, apiGet, apiPostParsed } from "../api/client";

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

export async function saveAdminMember(
  email: string,
  role: AdminMemberRole,
): Promise<AdminStateResponse | undefined> {
  return await apiPostParsed(
    "/admin/members",
    { email, role },
    adminStateResponseSchema,
    ABSENCE,
  );
}

export async function removeAdminMember(
  email: string,
): Promise<AdminStateResponse | undefined> {
  return await apiDeleteParsed(
    "/admin/members",
    { email },
    adminStateResponseSchema,
    ABSENCE,
  );
}
