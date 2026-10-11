import { describe, expect, it } from "vitest";

import { bodyOf, decl, stylesheet } from "./css-source";

const ROTATION = /^rotate\(-?\d+(\.\d+)?deg\)$/;
const TAPE = /^(translateX\(-50%\) )?rotate\(-?[3-5]deg\)$/;

describe("six game cards lay out without an orphan (T-WEB-S459)", () => {
  const hub = stylesheet("app/page.module.css");
  const hubMobile = bodyOf(hub, "@media (max-width: 768px)");
  const stats = stylesheet("app/estatisticas/page.module.css");

  it("puts the hub's six cards two rows of three: every card spans two of six tracks", () => {
    expect(decl(bodyOf(hub, ".games"), "grid-template-columns")).toBe(
      "repeat(6, 1fr)",
    );
    expect(decl(bodyOf(hub, ".card"), "grid-column")).toBe("span 2");
    expect(hub).not.toMatch(/\.card:nth-child\([^)]*\)\s*\{[^}]*grid-column/);
  });

  it.each([
    ["desktop", hub],
    ["≤ 768px", hubMobile],
  ])("rotates the sixth hub card and its tape (%s)", (_label, css) => {
    expect(decl(bodyOf(css, ".card:nth-child(6)"), "transform")).toMatch(
      ROTATION,
    );
    expect(decl(bodyOf(css, ".card:nth-child(6) .tape"), "transform")).toMatch(
      TAPE,
    );
  });

  it("keeps every stats card in the two-column grid, the sixth rotated like the rest", () => {
    for (let child = 1; child <= 6; child += 1) {
      const body = bodyOf(stats, `.gameCard:nth-child(${String(child)})`);
      expect(
        decl(body, "grid-column"),
        `card ${String(child)}`,
      ).toBeUndefined();
      expect(decl(body, "transform")).toMatch(ROTATION);
    }
    expect(
      decl(bodyOf(stats, ".gameCard:nth-child(6) .tape"), "transform"),
    ).toMatch(TAPE);
  });
});
