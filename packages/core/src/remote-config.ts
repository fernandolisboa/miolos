import { z } from "zod";

export const remoteConfigSchema = z.object({
  bufferDepth: z.number().int().min(1).max(30).default(7),
  attachStreakThreshold: z.number().int().min(1).max(365).default(5),
  pushOptInStreakThreshold: z.number().int().min(1).max(365).default(3),
});

export type RemoteConfig = z.infer<typeof remoteConfigSchema>;

export const remoteConfigKeySchema = remoteConfigSchema.keyof();

export type RemoteConfigKey = z.infer<typeof remoteConfigKeySchema>;

export function remoteConfigField(key: RemoteConfigKey) {
  return remoteConfigSchema.shape[key].unwrap();
}

export const defaultRemoteConfig: RemoteConfig = remoteConfigSchema.parse({});
