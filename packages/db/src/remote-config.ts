import {
  defaultRemoteConfig,
  remoteConfigSchema,
  type RemoteConfig,
} from "@miolos/core";

import type { Db } from "./client";
import { remoteConfig } from "./schema";

// Warn once per process — loud in the logs without repeating on every
// cron query.
let warnedInvalidRemoteConfig = false;

/**
 * Missing rows fall back to the schema defaults; any invalid value falls
 * back to `defaultRemoteConfig` entirely — the cron must run against an
 * empty or corrupted table rather than crash or trust garbage.
 */
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
