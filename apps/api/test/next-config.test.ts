import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

describe("next.config security headers", () => {
  it("applies nosniff and frame-ancestors 'none' to all routes", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0]!.source).toBe("/(.*)");
    expect(rules[0]!.headers).toContainEqual({
      key: "X-Content-Type-Options",
      value: "nosniff",
    });
    expect(rules[0]!.headers).toContainEqual({
      key: "Content-Security-Policy",
      value: "frame-ancestors 'none'",
    });
  });
});
