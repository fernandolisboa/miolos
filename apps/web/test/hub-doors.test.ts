import { describe, expect, it } from "vitest";

import { bodyOf, decl, stylesheet } from "./css-source";

const css = stylesheet("app/page.module.css");

const rules = [...css.matchAll(/([^{};]+)\{([^{}]*)\}/g)].map(
  ([, selector = "", body = ""]) => ({
    selector: selector.trim(),
    properties: body
      .split(";")
      .map((declaration) => declaration.split(":")[0]?.trim() ?? "")
      .filter(Boolean),
  }),
);

function selectorsDeclaring(selector: RegExp, property: RegExp): string[] {
  return rules
    .filter(
      (rule) =>
        selector.test(rule.selector) &&
        rule.properties.some((name) => property.test(name)),
    )
    .map((rule) => rule.selector);
}

describe("the hub's two doors sit side by side at every width (T-WEB-S307)", () => {
  it("lays the doors out as two equal grid columns", () => {
    const doors = bodyOf(css, ".doors");
    expect(decl(doors, "display")).toBe("grid");
    expect(
      decl(doors, "grid-template-columns"),
      "a bare 1fr track lets a long word push one door wider than the other",
    ).toBe("repeat(2, minmax(0, 1fr))");
  });

  it("never redefines the doors' grid in another rule", () => {
    expect(
      selectorsDeclaring(
        /\.doors(?![\w-])|\bnav\b/,
        /^(display|grid|grid-template.*|grid-auto.*|flex.*|columns)$/,
      ),
    ).toEqual([".doors"]);
  });

  it("never places or sizes a door against the grid", () => {
    expect(
      selectorsDeclaring(
        /\.door(?![\w-])|\.doors\s*[\s>+~]/,
        /^(grid-(column|row|area).*|(min-)?(width|inline-size))$/,
      ),
    ).toEqual([]);
  });

  it("uses no nested rules, which the two checks above cannot read", () => {
    expect(
      rules
        .map((rule) => rule.selector)
        .filter(
          (selector) => selector.startsWith("@") || selector.includes("&"),
        ),
    ).toEqual([]);
  });
});
