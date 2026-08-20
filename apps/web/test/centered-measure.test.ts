import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { bodyOf, decl, pixels, stylesheet } from "./css-source";

/**
 * The centered measure of the secondary pages (#160).
 *
 * A `.page` sheet that sets `max-width` without `margin-inline: auto` pins
 * to the left edge of every viewport wider than its measure: at 1920px the
 * /privacidade sheet sat at left offset 0 with 1060px of dead desk on the
 * right, /estatisticas at 0 with 940px (measured in a real browser for the
 * PR's evidence — jsdom implements no layout, so what lives here is the
 * tripwire on the declarations, the `css-source.ts` idiom). The recorded
 * fix is the archive's: "a max-width measure centred on desk paper" (plan
 * 037 §7.5, `arquivo.module.css`), i.e. `margin-inline: auto` beside the
 * `max-width`. Full-bleed sheets (the hub, modo-livre) set no `max-width`
 * and owe nothing.
 */
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

/**
 * The sweep that keeps the fix from regressing by copy-paste: the shells of
 * these pages are near-clones of one another (that is how /vincular shipped
 * the same defect as a third instance), so the invariant is stated over
 * every app stylesheet rather than the two the issue named.
 */
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
      // Only sheets that declare a top-level `.page` shell participate.
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
    // Anti-vacuity: the four sheets known to carry a measure today. A new
    // one joining the sweep is the point; one leaving it means the shell
    // changed shape and this test needs re-reading.
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
