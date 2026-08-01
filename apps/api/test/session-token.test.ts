import { describe, expect, it } from "vitest";

import { generateSessionToken, hashSessionToken } from "../src/session/token";

describe("generateSessionToken", () => {
  it("produces a 43-character base64url string (32 bytes, no padding)", () => {
    const token = generateSessionToken();
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("produces distinct tokens across calls", () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => generateSessionToken()),
    );
    expect(tokens.size).toBe(100);
  });
});

describe("hashSessionToken", () => {
  it("matches the known SHA-256 vector for 'abc'", async () => {
    await expect(hashSessionToken("abc")).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("is deterministic and lowercase hex", async () => {
    const token = generateSessionToken();
    const first = await hashSessionToken(token);
    const second = await hashSessionToken(token);
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });
});
