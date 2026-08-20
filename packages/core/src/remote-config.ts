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
 *
 * `pushOptInStreakThreshold` (#145, ADR-0064; the founding handoff's
 * "opt-in after streak >= 3"): the streak at which the push pre-prompt
 * becomes eligible — the `attachStreakThreshold` row cloned, same clamp
 * discipline. Read ONLY by GET /notifications/state, which serves a
 * derived boolean; the threshold never ships to a client (ADR-0048's
 * rule). It gates the ASK, never a send (the #32 shape §3).
 */
export const remoteConfigSchema = z.object({
  bufferDepth: z.number().int().min(1).max(30).default(7),
  attachStreakThreshold: z.number().int().min(1).max(365).default(5),
  pushOptInStreakThreshold: z.number().int().min(1).max(365).default(3),
});

export type RemoteConfig = z.infer<typeof remoteConfigSchema>;

export const defaultRemoteConfig: RemoteConfig = remoteConfigSchema.parse({});
