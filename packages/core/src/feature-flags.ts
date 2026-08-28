export type FeatureFlags = Readonly<Record<string, boolean>>;

export const defaultFeatureFlags: FeatureFlags = {};

export function isFeatureEnabled(flags: FeatureFlags, flag: string): boolean {
  return flags[flag] ?? false;
}
