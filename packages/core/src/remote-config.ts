import { z } from "zod";

import { FREE_HINTS_PER_PUZZLE, HINTS_PER_PUZZLE_CEILING } from "./completion";

const remoteConfigFields = {
  bufferDepth: z.number().int().min(1).max(30),
  attachStreakThreshold: z.number().int().min(1).max(365),
  pushOptInStreakThreshold: z.number().int().min(1).max(365),
  freeHintsPerPuzzle: z.number().int().min(1).max(HINTS_PER_PUZZLE_CEILING),
  termoAcceptsProfanity: z.boolean(),
};

export const remoteConfigSchema = z.object({
  bufferDepth: remoteConfigFields.bufferDepth.default(7),
  attachStreakThreshold: remoteConfigFields.attachStreakThreshold.default(5),
  pushOptInStreakThreshold:
    remoteConfigFields.pushOptInStreakThreshold.default(3),
  freeHintsPerPuzzle: remoteConfigFields.freeHintsPerPuzzle.default(
    FREE_HINTS_PER_PUZZLE,
  ),
  termoAcceptsProfanity:
    remoteConfigFields.termoAcceptsProfanity.default(false),
});

export type RemoteConfig = z.infer<typeof remoteConfigSchema>;

export const remoteConfigKeySchema = remoteConfigSchema.keyof();

export type RemoteConfigKey = z.infer<typeof remoteConfigKeySchema>;

export function remoteConfigField<K extends RemoteConfigKey>(
  key: K,
): (typeof remoteConfigFields)[K] {
  return remoteConfigFields[key];
}

export const defaultRemoteConfig: RemoteConfig = remoteConfigSchema.parse({});
