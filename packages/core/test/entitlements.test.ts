import { describe, expect, it } from "vitest";

import { hasEntitlement, type Entitlements } from "../src/index";

describe("hasEntitlement", () => {
  it("finds an entitlement that is present", () => {
    const entitlements: Entitlements = ["premium-crosswords", "pdf-edition"];
    expect(hasEntitlement(entitlements, "pdf-edition")).toBe(true);
  });

  it("rejects an entitlement that is absent", () => {
    const entitlements: Entitlements = ["premium-crosswords"];
    expect(hasEntitlement(entitlements, "pdf-edition")).toBe(false);
  });

  it("rejects everything on an empty array", () => {
    expect(hasEntitlement([], "anything")).toBe(false);
  });
});
