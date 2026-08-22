import { z } from "zod";

/**
 * The remote-config seam (ADR-0025): values live in the `remote_config`
 * table and are parsed through this schema by `getRemoteConfig` in
 * `packages/db`, with these in-code defaults applying when the table is
 * empty.
 *
 * The 1..30 clamp on `bufferDepth` bounds the cron's generation loop —
 * never derive loop bounds from untrusted input.
 *
 * `attachStreakThreshold` (ADR-0003, ADR-0050 decision 9): the streak at
 * which the attach prompt becomes eligible. Read only by GET /attach/state,
 * which serves a derived boolean — the threshold itself never ships to a
 * client. The 1..365 clamp is the same untrusted-loop-bounds discipline.
 *
 * `pushOptInStreakThreshold` (ADR-0064): the streak at which the push
 * pre-prompt becomes eligible, same clamp discipline. Read only by GET
 * /notifications/state; it gates the ASK, never a send.
 */
export const remoteConfigSchema = z.object({
  bufferDepth: z.number().int().min(1).max(30).default(7),
  attachStreakThreshold: z.number().int().min(1).max(365).default(5),
  pushOptInStreakThreshold: z.number().int().min(1).max(365).default(3),
});

export type RemoteConfig = z.infer<typeof remoteConfigSchema>;

export const defaultRemoteConfig: RemoteConfig = remoteConfigSchema.parse({});
