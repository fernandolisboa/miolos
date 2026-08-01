import { describe, expect, it } from "vitest";

import { isCrossSiteMint } from "../src/session/origin-guard";

const WEB = "https://miolos.app";

// Full matrix per plan 009 D13: deny on positive evidence of a cross-site
// request, never require proof — absent headers (curl, seam-4 tests, old
// clients) must always be allowed.
describe("isCrossSiteMint", () => {
  it.each(["same-origin", "same-site", "none"])(
    "allows Sec-Fetch-Site: %s",
    (secFetchSite) => {
      expect(isCrossSiteMint({ secFetchSite, origin: null }, WEB)).toBe(false);
    },
  );

  it("rejects Sec-Fetch-Site: cross-site", () => {
    expect(
      isCrossSiteMint({ secFetchSite: "cross-site", origin: null }, WEB),
    ).toBe(true);
  });

  it("rejects an Origin that differs from WEB_ORIGIN", () => {
    expect(
      isCrossSiteMint(
        { secFetchSite: null, origin: "https://evil.example" },
        WEB,
      ),
    ).toBe(true);
  });

  it("allows an Origin equal to WEB_ORIGIN", () => {
    expect(isCrossSiteMint({ secFetchSite: null, origin: WEB }, WEB)).toBe(
      false,
    );
  });

  it("allows any Origin when WEB_ORIGIN is unset (dev fallback)", () => {
    expect(
      isCrossSiteMint(
        { secFetchSite: null, origin: "https://evil.example" },
        undefined,
      ),
    ).toBe(false);
  });

  it("allows when both headers are absent (curl, non-browser clients)", () => {
    expect(isCrossSiteMint({ secFetchSite: null, origin: null }, WEB)).toBe(
      false,
    );
  });

  it("rejects cross-site evidence even when Origin matches (belt and braces)", () => {
    expect(
      isCrossSiteMint({ secFetchSite: "cross-site", origin: WEB }, WEB),
    ).toBe(true);
  });
});
