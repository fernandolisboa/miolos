import {
  defaultRemoteConfig,
  remoteConfigSchema,
  type RemoteConfig,
} from "@miolos/core";

import type { Db } from "./client";
import { remoteConfig } from "./schema";

let warnedInvalidRemoteConfig = false;

export async function getRemoteConfig(db: Db): Promise<RemoteConfig> {
  const rows = await db.select().from(remoteConfig);
  const merged: Record<string, unknown> = {};
  for (const row of rows) {
    merged[row.key] = row.value;
  }
  const parsed = remoteConfigSchema.safeParse(merged);
  if (!parsed.success) {
    if (!warnedInvalidRemoteConfig) {
      warnedInvalidRemoteConfig = true;
      console.error(
        "remote_config holds invalid values; falling back to defaults (ADR-0025)",
      );
    }
    return defaultRemoteConfig;
  }
  return parsed.data;
}
