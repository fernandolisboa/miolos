export type Entitlements = string[];

export function hasEntitlement(
  entitlements: Entitlements,
  entitlement: string,
): boolean {
  return entitlements.includes(entitlement);
}
