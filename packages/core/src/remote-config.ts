import { z } from "zod";

/**
 * The remote-config seam (ADR-0025): values live in the `remote_config`
 * table and are parsed through this schema by `getRemoteConfig` in
 * `packages/db`, with these in-code defaults applying when the table is
 * empty. Mirrors the `defaultFeatureFlags` dormant-seam pattern.
 *
 * The 1..30 clamp on `bufferDepth` is the "never derive loop bounds from
 * untrusted input" duty (sudoku generate.ts TSDoc, generalized to depth):
 * the cron's generation loop is bounded by this value.
 *
 * `attachStreakThreshold` (#21, ADR-0003's "starting at 5, tunable" —
 * ADR-0050 decision 9): the streak at which the attach prompt becomes
 * eligible. Read ONLY by GET /attach/state, which serves a derived boolean
 * — the threshold itself never ships to a client (ADR-0048's rule). The
 * 1..365 clamp is the same untrusted-loop-bounds discipline.
 */
export const remoteConfigSchema = z.object({
  bufferDepth: z.number().int().min(1).max(30).default(7),
  attachStreakThreshold: z.number().int().min(1).max(365).default(5),
});

export type RemoteConfig = z.infer<typeof remoteConfigSchema>;

export const defaultRemoteConfig: RemoteConfig = remoteConfigSchema.parse({});
