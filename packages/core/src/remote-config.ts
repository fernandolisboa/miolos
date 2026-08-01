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
 */
export const remoteConfigSchema = z.object({
  bufferDepth: z.number().int().min(1).max(30).default(7),
});

export type RemoteConfig = z.infer<typeof remoteConfigSchema>;

export const defaultRemoteConfig: RemoteConfig = remoteConfigSchema.parse({});
