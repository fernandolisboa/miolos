import { describe, expect, it } from "vitest";

import { accentVars } from "../src/play/accent";
import { bodyOf, decl, stylesheet } from "./css-source";

/**
 * The gate on `--ink-on-accent` (step-6 finding ISS-A2).
 *
 * `--accent-nonogram` #B5563C carries `--paper-desk` #F7F2E9 at a measured
 * **4.318:1** — below PRODUCT.md's ">=4.5:1 for body text" — so every filled
 * button that wears terracotta had an illegible label: `screen.hint` on
 * `/nonogram`, `conclusion-view.emptyCta` on `/nonogram/concluido`,
 * `page.cta` on the hub's Nonogram card, and `conclusion-view.ctaNext`, which
 * renders on the SHIPPED binairo and sudoku conclusions whenever the day
 * still owes a nonogram. `--paper-card` #FBF7EF on the same fill is
 * **4.506:1** — the identical one-token remedy
 * `nonogram-board.module.css:461-463` already applies to `.controlActive`.
 *
 * Why the assertions are on stylesheet TEXT: the test environment is jsdom,
 * which implements no layout and no cascade worth the name, so no rendering
 * test in this suite can resolve a custom property fallback chain, let alone
 * composite a colour. The real figures come from a browser (the numbers are
 * in the PR body); what lives here is the tripwire that stops the mechanism
 * being undone silently — the reason `css-source.ts` exists at all.
 *
 * The other half of ISS-A2 — accent TEXT on desk paper, the 11px kickers at
 * 4.318:1 and the 17px `.chipDone .chipName` at 3.969:1 — is deliberately NOT
 * asserted here. Fixing it means darkening `--accent-nonogram`, which changes
 * the Ateliê winner's palette and decides Termo (2.731:1) at the same time.
 * That is a design decision and it is filed, with every measured figure, as
 * **#68**.
 */
describe("the ink on an accent fill (T-WEB-S72)", () => {
  /** Every sheet in the app that paints a `var(--accent)` background. */
  const SHEETS = [
    "src/play/screen.module.css",
    "src/play/conclusion-view.module.css",
    "app/page.module.css",
    "src/nonogram/nonogram-board.module.css",
  ] as const;

  it("leaves no desk label on an accent fill, in any stylesheet", () => {
    // The non-vacuous half: a scan rather than a list, so a filled button
    // added later cannot reintroduce the pair without tripping this. Blocks
    // are split on `}` at a line start, which is the shape every rule in
    // these four sheets has.
    const offenders: string[] = [];
    for (const sheet of SHEETS) {
      const css = stylesheet(sheet);
      for (const block of css.split(/^\}$/m)) {
        if (
          /background:\s*var\(--accent\)/.test(block) &&
          /color:\s*var\(--paper-desk\)/.test(block)
        ) {
          offenders.push(
            `${sheet} ${(/^\s*(\S.*?)\s*\{/m.exec(block) ?? [])[1] ?? "?"}`,
          );
        }
      }
    }
    expect(
      offenders,
      "--paper-desk on a --accent fill is 4.318:1 on terracotta",
    ).toEqual([]);
  });

  it("reads the label colour through the property, with the shipped desk ink as its fallback", () => {
    // The fallback is the whole reason binairo and sudoku are byte-identical,
    // and it is NOT decoration: `--board-mobile-max` is read at
    // `screen.module.css:409` with none (landmine N12), so a header comment
    // claiming a fallback is not evidence of one. Pinned literally.
    const READ = "var(--ink-on-accent, var(--paper-desk))";
    const sites = [
      ["src/play/screen.module.css", ".hint"],
      ["src/play/conclusion-view.module.css", ".ctaNext"],
      ["src/play/conclusion-view.module.css", ".page .cta.ctaNext:hover"],
      ["src/play/conclusion-view.module.css", ".emptyCta"],
      ["src/play/conclusion-view.module.css", ".page .emptyCta:hover"],
      ["app/page.module.css", ".cta"],
      ["app/page.module.css", ".cta:hover"],
    ] as const;

    for (const [sheet, selector] of sites) {
      expect(
        decl(bodyOf(stylesheet(sheet), selector), "color"),
        `${sheet} ${selector}`,
      ).toBe(READ);
    }
  });

  it("keeps the chaining CTA's hover above the shared solid-CTA hover", () => {
    // `.page .cta:hover` (0,3,0) legitimately keeps `--paper-desk` — its
    // subject is the button on the `--ink` fill. The accent-filled variant
    // therefore has to WIN on specificity: `.page .cta.ctaNext:hover` is
    // (0,4,0), so no stylesheet ordering decides whether the destination
    // game's label stays legible under the pointer. `impeccable detect` never
    // exercises hover, so this is the only gate.
    const css = stylesheet("src/play/conclusion-view.module.css");

    expect(decl(bodyOf(css, ".page .cta:hover"), "color")).toBe(
      "var(--paper-desk)",
    );
    expect(css).toMatch(/^\.page \.cta\.ctaNext:hover \{/m);
    // The (0,3,0) form of the same rule would tie instead of winning.
    expect(css).not.toMatch(/^\.page \.ctaNext:hover \{/m);
  });

  it("moves Nonogram and nothing else", () => {
    // The byte-identity half. `--paper-desk` is the literal the three other
    // games' filled buttons carried before this fix, so a change to any of
    // them is a visible change to a shipped screen and fails here.
    expect(accentVars("binairo")).toEqual({
      "--accent": "var(--accent-binairo)",
      "--ink-on-accent": "var(--paper-desk)",
    });
    expect(accentVars("sudoku")).toEqual({
      "--accent": "var(--accent-sudoku)",
      "--ink-on-accent": "var(--paper-desk)",
    });
    // Termo is NOT rescued: desk on mustard is 2.731:1 and card would be
    // 2.736:1, so only a palette change clears AA. #68 owns it.
    expect(accentVars("termo")).toEqual({
      "--accent": "var(--accent-termo)",
      "--ink-on-accent": "var(--paper-desk)",
    });
    expect(accentVars("nonogram")).toEqual({
      "--accent": "var(--accent-nonogram)",
      "--ink-on-accent": "var(--paper-card)",
    });
  });
});
