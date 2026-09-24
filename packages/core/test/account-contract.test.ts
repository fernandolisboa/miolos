import { describe, expect, it } from "vitest";

import { accountStateResponseSchema } from "../src/index";

describe("accountStateResponseSchema", () => {
  it("T-CORE-S116: is strict, the email is nullable but never absent, and consent is a boolean", () => {
    expect(
      accountStateResponseSchema.parse({
        email: "jogadora@example.com",
        reminderConsent: true,
      }),
    ).toEqual({ email: "jogadora@example.com", reminderConsent: true });
    expect(
      accountStateResponseSchema.parse({ email: null, reminderConsent: false }),
    ).toEqual({ email: null, reminderConsent: false });

    for (const invalid of [
      { reminderConsent: false },
      { email: null },
      { email: null, reminderConsent: "yes" },
      { email: 1, reminderConsent: false },
      { email: null, reminderConsent: false, userId: "x" },
    ]) {
      expect(
        accountStateResponseSchema.safeParse(invalid).success,
        JSON.stringify(invalid),
      ).toBe(false);
    }
  });
});
