import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { attachEmailSchema } from "../src/index";

describe("attachEmailSchema normalization (T-CORE-S50)", () => {
  it("T-CORE-S50: parse ∘ parse = parse, and every output is its own trim/lowercase", () => {
    fc.assert(
      fc.property(
        fc
          .tuple(
            fc.stringMatching(/^[A-Za-z0-9._%+-]{1,20}$/),
            fc.stringMatching(/^[A-Za-z0-9-]{1,15}$/),
            fc.constantFrom("com", "app", "com.br", "net"),
            fc.constantFrom("", " ", "  ", "\t"),
            fc.constantFrom("", " ", "\n"),
          )
          .map(
            ([local, domain, tld, lead, trail]) =>
              `${lead}${local}@${domain}.${tld}${trail}`,
          ),
        (candidate) => {
          const first = attachEmailSchema.safeParse(candidate);
          if (!first.success) {
            return;
          }
          expect(first.data).toBe(first.data.trim().toLowerCase());
          const second = attachEmailSchema.safeParse(first.data);
          expect(second.success).toBe(true);
          if (second.success) {
            expect(second.data).toBe(first.data);
          }
        },
      ),
      { numRuns: 100, seed: 20_260_813 },
    );
  });
});
