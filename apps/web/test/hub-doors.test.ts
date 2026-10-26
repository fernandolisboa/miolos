import { describe, expect, it } from "vitest";

import { bodyOf, decl, stylesheet } from "./css-source";

describe("the hub's two doors sit side by side at every width (T-WEB-S307)", () => {
  const css = stylesheet("app/page.module.css");
  const mobile = bodyOf(css, "@media (max-width: 768px)");

  it("lays the doors out as two equal grid columns", () => {
    const doors = bodyOf(css, ".doors");
    expect(decl(doors, "display")).toBe("grid");
    expect(
      decl(doors, "grid-template-columns"),
      "a bare 1fr track lets a long word push one door wider than the other",
    ).toBe("repeat(2, minmax(0, 1fr))");
  });

  it("keeps the two columns on mobile", () => {
    const doors = bodyOf(mobile, ".doors");
    expect(decl(doors, "display")).toBeUndefined();
    expect(decl(doors, "grid-template-columns")).toBeUndefined();
  });
});
