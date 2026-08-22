import { describe, expect, it } from "vitest";

import { adSlotPlacements } from "../src/index";

describe("adSlotPlacements", () => {
  it("reserves exactly 60px for the desktop hub strip", () => {
    expect(adSlotPlacements["hub-desktop"]).toEqual({ minHeightPx: 60 });
  });

  it("reserves exactly 64px for the mobile hub strip", () => {
    expect(adSlotPlacements["hub-mobile"]).toEqual({ minHeightPx: 64 });
  });

  it("has exactly the two hub placements", () => {
    expect(Object.keys(adSlotPlacements).sort()).toEqual([
      "hub-desktop",
      "hub-mobile",
    ]);
  });
});
