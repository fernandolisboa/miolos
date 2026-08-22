import { describe, expect, it } from "vitest";

import { bodyOf, decl, stylesheet } from "./css-source";

/**
 * The hub's secondary-links row wraps at 390px (#169).
 *
 * `.secondaryLinks` is a flex row, and flex rows do not wrap by default.
 * With the fifth link (#158's Termos de Uso) its min-content width exceeds
 * 390px minus the page padding, so the first and last links clip at the
 * viewport edges ("quivo", "Termos" cut — measured in a real browser;
 * jsdom implements
 * no layout, so what lives here is the tripwire on the declarations, the
 * `css-source.ts` idiom, comments already stripped by `stylesheet()`
 * (T-LINT-S37's rule). The CI impeccable scan cannot catch it because the
 * row sits below the 390×844 first viewport.
 *
 * The pin is on the MOBILE block inside the 768px media query, where the
 * clip actually happens: `flex-wrap: wrap` so a row that cannot fit breaks
 * instead of clipping, and an explicit `row-gap` so the wrapped rows do
 * not inherit the 28px column gap as vertical distance between two rows
 * of 15px links.
 */
describe("the hub secondary-links row wraps on mobile (T-WEB-S307)", () => {
  const mobile = bodyOf(
    stylesheet("app/page.module.css"),
    "@media (max-width: 768px)",
  );
  const links = bodyOf(mobile, ".secondaryLinks");

  it("declares flex-wrap: wrap", () => {
    expect(
      decl(links, "flex-wrap"),
      "an unwrapped flex row clips its first and last links at 390px",
    ).toBe("wrap");
  });

  it("declares an explicit row-gap for the wrapped rows", () => {
    expect(
      decl(links, "row-gap"),
      "without a row-gap the wrapped rows sit a 28px column gap apart",
    ).toBe("var(--space-3)");
  });
});
