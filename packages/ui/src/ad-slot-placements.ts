export const adSlotPlacements = {
  "hub-desktop": { minHeightPx: 60 },
  "hub-mobile": { minHeightPx: 64 },
} as const;

export type AdSlotPlacement = keyof typeof adSlotPlacements;
