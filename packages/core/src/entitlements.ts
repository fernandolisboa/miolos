/**
 * Dormant monetization seam (ADR-0006): entitlements are an array of
 * string identifiers, never a boolean. Nothing grants entitlements in v1;
 * the shape exists so activation is additive.
 */
export type Entitlements = string[];

export function hasEntitlement(
  entitlements: Entitlements,
  entitlement: string,
): boolean {
  return entitlements.includes(entitlement);
}
