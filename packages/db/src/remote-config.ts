import {
  remoteConfigField,
  remoteConfigKeySchema,
  remoteConfigSchema,
  type RemoteConfig,
  type RemoteConfigKey,
} from "@miolos/core";
import { sql } from "drizzle-orm";

import type { Db } from "./client";
import { remoteConfig } from "./schema";

const warnedInvalidKeys = new Set<RemoteConfigKey>();

export async function getRemoteConfig(db: Db): Promise<RemoteConfig> {
  const rows = await db.select().from(remoteConfig);
  const stored: Partial<Record<RemoteConfigKey, unknown>> = {};
  for (const row of rows) {
    const key = remoteConfigKeySchema.safeParse(row.key);
    if (!key.success) {
      continue;
    }
    if (remoteConfigField(key.data).safeParse(row.value).success) {
      stored[key.data] = row.value;
    } else if (!warnedInvalidKeys.has(key.data)) {
      warnedInvalidKeys.add(key.data);
      console.error(
        `remote_config holds an invalid ${key.data}; falling back to its default (ADR-0097)`,
      );
    }
  }
  return remoteConfigSchema.parse(stored);
}

export async function setRemoteConfigValue<K extends RemoteConfigKey>(
  db: Db,
  key: K,
  value: RemoteConfig[K],
): Promise<void> {
  await db
    .insert(remoteConfig)
    .values({ key, value })
    .onConflictDoUpdate({
      target: remoteConfig.key,
      set: { value, updatedAt: sql`now()` },
    });
}
