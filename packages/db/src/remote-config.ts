import {
  defaultRemoteConfig,
  remoteConfigSchema,
  type RemoteConfig,
} from "@miolos/core";

import type { Db } from "./client";
import { remoteConfig } from "./schema";

// Once-per-process: a corrupted table should be loud in the logs, not
// once per cron query (session route's warn-once precedent).
let warnedInvalidRemoteConfig = false;

/**
 * All rows → { [key]: value } → remoteConfigSchema (ADR-0025). Missing
 * table rows fall back to the schema defaults, and invalid values fall
 * back to `defaultRemoteConfig` entirely (safeParse) — the cron must run
 * against an empty or corrupted table rather than crash or trust
 * garbage. Reachable only via `@miolos/db/publishing` (ADR-0024).
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
