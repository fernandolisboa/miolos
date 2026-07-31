import { adSlotPlacements, type AdSlotPlacement } from "@miolos/ui";

/**
 * Dormant promo seam (ADR-0006, CLAUDE.md invariants): renders nothing
 * visible but reserves its final dimensions, so activation is a paint,
 * never a reflow. No ads SDK, no third-party creative, ever.
 */
export function AdSlot({
  placement,
  className,
}: {
  placement: AdSlotPlacement;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={className}
      data-ad-placement={placement}
      style={{ minHeight: adSlotPlacements[placement].minHeightPx }}
    />
  );
}
