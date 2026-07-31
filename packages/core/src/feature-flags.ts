/**
 * Dormant remote-feature-flag seam. Remote resolution arrives with a later
 * ticket; the type, the default and the accessor are the whole M0 shape.
 */
export type FeatureFlags = Readonly<Record<string, boolean>>;

export const defaultFeatureFlags: FeatureFlags = {};

export function isFeatureEnabled(flags: FeatureFlags, flag: string): boolean {
  return flags[flag] ?? false;
}
