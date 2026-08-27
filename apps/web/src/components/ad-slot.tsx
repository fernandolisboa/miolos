import { adSlotPlacements, type AdSlotPlacement } from "@miolos/ui";

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
