import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { attachEmailSchema } from "../src/index";

/**
 * The one genuine property in the attach contracts (plan 031 §10, ADR-0023:
 * main properties run at ≥ 100): normalization is idempotent. Every string
 * that parses re-parses to the same value, and every parsed output is
 * already trimmed and lowercased — which is what lets D6 layer 3 index the
 * raw `users.email` column with no expression index. Nothing else in these
 * contracts is a property; none is forced into property shape.
 */
describe("attachEmailSchema normalization (T-CORE-S50)", () => {
  it("T-CORE-S50: parse ∘ parse = parse, and every output is its own trim/lowercase", () => {
    fc.assert(
      fc.property(
        // Plausible address material with case and whitespace noise —
        // arbitrary strings almost never parse as emails, so the local and
        // domain halves are generated and decorated instead.
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
            // Not every generated string is a valid address (e.g. a local
            // part ending in "."); the property quantifies over the ones
            // that parse.
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
