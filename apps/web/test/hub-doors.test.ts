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

function rulesWhere(
  targets: (subject: string, selector: string) => boolean,
  property: RegExp,
): string[] {
  return rules
    .filter(
      ({ selector, properties }) =>
        selector.split(",").some((part) => {
          const subject =
            part
              .trim()
              .split(/[\s>+~]+/)
              .at(-1) ?? "";
          return targets(subject, part);
        }) && properties.some((name) => property.test(name)),
    )
    .map(({ selector }) => selector);
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
      rulesWhere(
        (subject) => /^\.doors(?![\w-])/.test(subject),
        /^(display|grid|grid-template.*|flex.*|columns)$/,
      ),
    ).toEqual([".doors"]);
  });

  it("never places or sizes a door against the grid", () => {
    expect(
      rulesWhere(
        (subject, selector) =>
          /^\.door(?![\w-])/.test(subject) ||
          (/\.doors(?![\w-])/.test(selector) && !/^\.doors/.test(subject)),
        /^(grid-(column|row|area).*|width|min-width)$/,
      ),
    ).toEqual([]);
  });
});
