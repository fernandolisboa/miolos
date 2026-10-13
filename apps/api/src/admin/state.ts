import {
  adminStateResponseSchema,
  type AdminStateResponse,
} from "@miolos/core";
import type { Db } from "@miolos/db";
import {
  adminRoleOf,
  getRemoteConfig,
  listAdminMembers,
} from "@miolos/db/publishing";

export async function adminState(
  db: Db,
  userId: string,
): Promise<AdminStateResponse> {
  const { email, role } = await adminRoleOf(db, userId);
  if (role === null) {
    return adminStateResponseSchema.parse({ role: "none", email });
  }
  const config = await getRemoteConfig(db);
  if (role === "admin") {
    return adminStateResponseSchema.parse({ role, email, config });
  }
  return adminStateResponseSchema.parse({
    role,
    email,
    config,
    members: await listAdminMembers(db),
  });
}
