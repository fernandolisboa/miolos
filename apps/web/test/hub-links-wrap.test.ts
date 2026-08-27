import { describe, expect, it } from "vitest";

import { bodyOf, decl, stylesheet } from "./css-source";

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
