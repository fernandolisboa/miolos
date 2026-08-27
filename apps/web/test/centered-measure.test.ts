import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { bodyOf, decl, pixels, stylesheet } from "./css-source";

describe("secondary pages center their measure (T-WEB-S291)", () => {
  it.each([
    ["app/privacidade/page.module.css", 860],
    ["app/estatisticas/page.module.css", 980],
  ])("%s centers its %ipx sheet", (sheet, measure) => {
    const body = bodyOf(stylesheet(sheet), ".page");
    expect(pixels(decl(body, "max-width"))).toBe(measure);
    expect(
      decl(body, "margin-inline"),
      "a max-width sheet without margin-inline: auto hugs the left edge",
    ).toBe("auto");
  });
});

describe("no page sheet declares a measure it does not center (T-WEB-S292)", () => {
  const appDir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "app",
  );

  const moduleSheets = readdirSync(appDir, { recursive: true })
    .map(String)
    .filter((entry) => entry.endsWith(".module.css"))
    .map((entry) => path.join("app", entry));

  it("every `.page` block with a max-width also declares margin-inline: auto", () => {
    const measured: string[] = [];
    for (const sheet of moduleSheets) {
      const css = stylesheet(sheet);

      if (!/^[ \t]*\.page[ \t]*\{/m.test(css)) {
        continue;
      }
      const body = bodyOf(css, ".page");
      if (decl(body, "max-width") === undefined) {
        continue;
      }
      measured.push(sheet);
      expect(
        decl(body, "margin-inline"),
        `${sheet} sets a max-width measure without centering it`,
      ).toBe("auto");
    }

    expect(measured).toEqual(
      expect.arrayContaining([
        path.join("app", "arquivo", "arquivo.module.css"),
        path.join("app", "estatisticas", "page.module.css"),
        path.join("app", "privacidade", "page.module.css"),
        path.join("app", "vincular", "page.module.css"),
      ]),
    );
  });
});
