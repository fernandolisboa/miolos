import { describe, expect, it } from "vitest";

import {
  accountGoogleResponseSchema,
  accountUnlinkGoogleResponseSchema,
  accountUnlinkGoogleSchema,
  googleIdTokenClaimsSchema,
} from "../src/index";

function rejects(
  schema: { safeParse: (value: unknown) => { success: boolean } },
  values: unknown[],
): void {
  for (const value of values) {
    expect(schema.safeParse(value).success, JSON.stringify(value)).toBe(false);
  }
}

describe("the Google contracts (ADR-0089)", () => {
  it("T-CORE-S160: the account's Google state is a strict object holding one of three words, never the Google id", () => {
    for (const google of ["unavailable", "unlinked", "linked"]) {
      expect(accountGoogleResponseSchema.parse({ google })).toEqual({ google });
    }
    rejects(accountGoogleResponseSchema, [
      {},
      { google: true },
      { google: "108234567890" },
      { google: null },
      { google: "linked", googleId: "108234567890" },
    ]);
  });

  it("T-CORE-S161: unlinking takes only the literal {confirm: true} and answers the literal {unlinked: true}", () => {
    expect(accountUnlinkGoogleSchema.parse({ confirm: true })).toEqual({
      confirm: true,
    });
    rejects(accountUnlinkGoogleSchema, [
      {},
      { confirm: false },
      { confirm: "true" },
      { confirm: true, googleId: "x" },
    ]);
    expect(accountUnlinkGoogleResponseSchema.parse({ unlinked: true })).toEqual(
      { unlinked: true },
    );
    rejects(accountUnlinkGoogleResponseSchema, [
      { unlinked: false },
      {},
      { unlinked: true, extra: 1 },
    ]);
  });

  it("T-CORE-S162: an ID token's claims need Google's issuer, an audience, a numeric expiry and a non-empty subject", () => {
    const good = {
      iss: "https://accounts.google.com",
      aud: "client",
      exp: 1,
      sub: "108234567890",
      email: "ignored@example.com",
    };
    expect(googleIdTokenClaimsSchema.parse(good).sub).toBe("108234567890");
    expect(
      googleIdTokenClaimsSchema.parse({ ...good, iss: "accounts.google.com" })
        .sub,
    ).toBe("108234567890");
    rejects(googleIdTokenClaimsSchema, [
      { ...good, iss: "https://evil.example" },
      { ...good, aud: ["client"] },
      { ...good, exp: "1" },
      { ...good, sub: "" },
      { ...good, sub: undefined },
    ]);
  });
});
