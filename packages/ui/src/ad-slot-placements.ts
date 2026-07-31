/**
 * The value half of the dormant AdSlot seam (ADR-0006, CLAUDE.md
 * invariants): each placement reserves its final dimensions so activation
 * is a paint, never a reflow. The component itself (JSX) lives in
 * apps/web — packages/ui holds tokens and primitives only (ADR-0002).
 *
 * Heights are the DESIGN.md-measured reserved zones: 60px desktop hub
 * strip, 64px mobile hub strip.
 */
export const adSlotPlacements = {
  "hub-desktop": { minHeightPx: 60 },
  "hub-mobile": { minHeightPx: 64 },
} as const;

export type AdSlotPlacement = keyof typeof adSlotPlacements;
