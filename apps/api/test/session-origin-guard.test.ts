import { afterEach, describe, expect, it, vi } from "vitest";

import { isCrossSiteWrite } from "../src/session/origin-guard";

const WEB = "https://miolos.app";

// Full matrix per plan 009 D13: deny on positive evidence of a cross-site
// request, never require proof — absent headers (curl, seam-4 tests, old
// clients) must always be allowed.
describe("isCrossSiteWrite", () => {
  it.each(["same-origin", "same-site", "none"])(
    "allows Sec-Fetch-Site: %s",
    (secFetchSite) => {
      expect(isCrossSiteWrite({ secFetchSite, origin: null }, WEB)).toBe(false);
    },
  );

  it("rejects Sec-Fetch-Site: cross-site", () => {
    expect(
      isCrossSiteWrite({ secFetchSite: "cross-site", origin: null }, WEB),
    ).toBe(true);
  });

  it("rejects an Origin that differs from WEB_ORIGIN", () => {
    expect(
      isCrossSiteWrite(
        { secFetchSite: null, origin: "https://evil.example" },
        WEB,
      ),
    ).toBe(true);
  });

  it("allows an Origin equal to WEB_ORIGIN", () => {
    expect(isCrossSiteWrite({ secFetchSite: null, origin: WEB }, WEB)).toBe(
      false,
    );
  });

  it("allows any Origin when WEB_ORIGIN is unset (dev fallback)", () => {
    expect(
      isCrossSiteWrite(
        { secFetchSite: null, origin: "https://evil.example" },
        undefined,
      ),
    ).toBe(false);
  });

  it("allows when both headers are absent (curl, non-browser clients)", () => {
    expect(isCrossSiteWrite({ secFetchSite: null, origin: null }, WEB)).toBe(
      false,
    );
  });

  it("rejects cross-site evidence even when Origin matches (belt and braces)", () => {
    expect(
      isCrossSiteWrite({ secFetchSite: "cross-site", origin: WEB }, WEB),
    ).toBe(true);
  });
});

// T-API-16. The once-per-instance flag is module state, so each case takes
// a FRESH module instance — asserting "does not log" against an already
// tripped flag would pass for the wrong reason.
async function freshGuardModule() {
  vi.resetModules();
  return import("../src/session/origin-guard");
}

describe("warnIfGuardDegraded", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("logs exactly once per instance in production with WEB_ORIGIN unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WEB_ORIGIN", undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const { warnIfGuardDegraded } = await freshGuardModule();
    warnIfGuardDegraded();
    warnIfGuardDegraded();
    warnIfGuardDegraded();

    expect(error).toHaveBeenCalledTimes(1);
    const message: unknown = error.mock.calls[0]?.[0];
    expect(message).toContain("WEB_ORIGIN is unset in production");
    expect(message).toContain("ADR-0022");
  });

  it("stays silent when WEB_ORIGIN is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WEB_ORIGIN", WEB);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const { warnIfGuardDegraded } = await freshGuardModule();
    warnIfGuardDegraded();

    expect(error).not.toHaveBeenCalled();
  });

  it("stays silent outside production (previews legitimately run ungranted)", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("WEB_ORIGIN", undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const { warnIfGuardDegraded } = await freshGuardModule();
    warnIfGuardDegraded();

    expect(error).not.toHaveBeenCalled();
  });
});
