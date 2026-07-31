import { afterEach, describe, expect, it, vi } from "vitest";

import { buildSessionCookie, SESSION_COOKIE_NAME } from "../src/session/cookie";

// Serialization matrix per plan 009 D10: Domain comes from COOKIE_DOMAIN
// alone; Secure comes from COOKIE_DOMAIN being set OR NODE_ENV=production
// (so https *.vercel.app previews get a Secure cookie, local http dev does
// not).
describe("buildSessionCookie", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("serializes the local-dev shape: no Domain, no Secure", () => {
    vi.stubEnv("COOKIE_DOMAIN", undefined);
    expect(buildSessionCookie("tok")).toBe(
      `${SESSION_COOKIE_NAME}=tok; Path=/; Max-Age=34560000; HttpOnly; SameSite=Lax`,
    );
  });

  it("emits Domain and Secure when COOKIE_DOMAIN is set", () => {
    vi.stubEnv("COOKIE_DOMAIN", "miolos.app");
    const cookie = buildSessionCookie("tok");
    expect(cookie).toContain("; Domain=miolos.app");
    expect(cookie).toContain("; Secure");
  });

  it("emits Secure without Domain in production with COOKIE_DOMAIN unset (preview shape)", () => {
    vi.stubEnv("COOKIE_DOMAIN", undefined);
    vi.stubEnv("NODE_ENV", "production");
    const cookie = buildSessionCookie("tok");
    expect(cookie).toContain("; Secure");
    expect(cookie).not.toContain("Domain=");
  });

  it("always carries the identity-critical attributes", () => {
    vi.stubEnv("COOKIE_DOMAIN", "miolos.app");
    const cookie = buildSessionCookie("tok");
    expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE_NAME}=tok; `));
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=34560000");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });
});
