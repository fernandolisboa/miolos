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
 * The other half of ISS-A2 — accent TEXT on paper — is **#68**, and
 * ADR-0041 decided it on 2026-08-02: *accents colour shapes, never words*.
 * The token values stay; `--accent` stops being a `color:`. The suite below
 * this one is that decision's gate.
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

  it("reads the label colour through the property, with the site's own safe fallback", () => {
    // The fallback is real and load-bearing — `--board-mobile-max` is read at
    // `screen.module.css:409` with none (landmine N12), so a header comment
    // claiming a fallback is not evidence of one. Pinned literally.
    //
    // The fallback is PER SITE, not one literal for all of them (ADR-0041
    // consequence (c)). Every surface below can render any of the four
    // accents, so its fallback is the shipped `var(--paper-desk)`; a surface
    // that can only ever render mustard takes `var(--ink)` instead, because
    // desk on mustard is 2.7311:1. Termo's board and keys are the only such
    // surfaces in the repo and they arrive with #27, so the third column
    // exists before it has a second value rather than being reshaped later.
    const sites = [
      ["src/play/screen.module.css", ".hint", "var(--paper-desk)"],
      ["src/play/conclusion-view.module.css", ".ctaNext", "var(--paper-desk)"],
      [
        "src/play/conclusion-view.module.css",
        ".page .cta.ctaNext:hover",
        "var(--paper-desk)",
      ],
      ["src/play/conclusion-view.module.css", ".emptyCta", "var(--paper-desk)"],
      [
        "src/play/conclusion-view.module.css",
        ".page .emptyCta:hover",
        "var(--paper-desk)",
      ],
      ["app/page.module.css", ".cta", "var(--paper-desk)"],
      ["app/page.module.css", ".cta:hover", "var(--paper-desk)"],
    ] as const;

    for (const [sheet, selector, fallback] of sites) {
      expect(
        decl(bodyOf(stylesheet(sheet), selector), "color"),
        `${sheet} ${selector}`,
      ).toBe(`var(--ink-on-accent, ${fallback})`);
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

  it("moves Termo to ink, Nonogram to card paper, and nothing else", () => {
    // The byte-identity half. `--paper-desk` is the literal binairo's and
    // sudoku's filled buttons carried before either fix, so a change to
    // either is a visible change to a shipped screen and fails here.
    expect(accentVars("binairo")).toEqual({
      "--accent": "var(--accent-binairo)",
      "--ink-on-accent": "var(--paper-desk)",
    });
    expect(accentVars("sudoku")).toEqual({
      "--accent": "var(--accent-sudoku)",
      "--ink-on-accent": "var(--paper-desk)",
    });
    // ADR-0041 decision 2: the property's range is "an ink legible on this
    // accent", not "a paper token". Desk on mustard is 2.7311:1, card is
    // 2.8501:1 and tint is 2.5457:1 — no paper clears 4.5 — while `--ink`
    // #211D19 ON mustard is 5.4968:1.
    expect(accentVars("termo")).toEqual({
      "--accent": "var(--accent-termo)",
      "--ink-on-accent": "var(--ink)",
    });
    expect(accentVars("nonogram")).toEqual({
      "--accent": "var(--accent-nonogram)",
      "--ink-on-accent": "var(--paper-card)",
    });
  });
});

/**
 * The gate on ADR-0041: **an accent may colour a shape, never a word**.
 *
 * The three sheets below are SHARED — every play screen and every conclusion
 * renders them with `--accent` bound to the game's own token — so each of
 * them had to be legible against the worst of the four accents, and mustard
 * is 2.7311:1 on desk paper and 2.8501:1 on card. Both fail PRODUCT.md's
 * 4.5:1 floor, and 2.8501:1 is the ceiling over the whole paper family, so
 * no paper token was ever going to rescue them.
 *
 * `impeccable detect` cannot see any of this and never will: `low-contrast`
 * and `cream-palette` are wildcard-ignored on every host CI scans
 * (`.impeccable/config.json:19-39`, #51). A green detect run is not evidence
 * for a single figure in this file. This suite is the whole automated gate.
 *
 * The five `color: var(--accent)` declarations in the PER-GAME board modules
 * (`sudoku-board.module.css:155,164,165,249`,
 * `nonogram-board.module.css:426`) are deliberately not scanned: each renders
 * exactly one accent and each already clears AA for it — sudoku's
 * `.cellEntered` 7.5113:1, its `.keypadDigit` 7.8385:1, nonogram's `.control`
 * 4.5063:1 — so converting them would be a visible change to shipped screens
 * with no defect behind it (plan 022 §16.2).
 */
describe("accents colour shapes, never words (T-WEB-S73)", () => {
  /** The three sheets every game renders, and the only ones ADR-0041 §3 converts. */
  const SHARED = [
    "src/play/screen.module.css",
    "src/play/conclusion-view.module.css",
    "app/page.module.css",
  ] as const;

  it("declares no accent-coloured text anywhere in the shared sheets", () => {
    // A scan, not a list, so the eleven conversions cannot be undone one at a
    // time and a twelfth site cannot be added. Anchored on a line start or a
    // `;` so `border-color:` and `text-decoration-color:` — both SHAPES, both
    // sanctioned by decision 1 — are not swept up by a substring match.
    const offenders: string[] = [];
    for (const sheet of SHARED) {
      const css = stylesheet(sheet);
      for (const block of css.split(/^\}$/m)) {
        if (/(?:^|;)\s*color:\s*var\(--accent\)/m.test(block)) {
          offenders.push(
            `${sheet} ${(/^\s*(\S.*?)\s*\{/m.exec(block) ?? [])[1] ?? "?"}`,
          );
        }
      }
    }
    expect(
      offenders,
      "ADR-0041: an accent may colour a shape, never a word",
    ).toEqual([]);
  });

  it("paints the eleven converted sites in a neutral ink", () => {
    // Every row is one of the eleven declarations plan 022 §16.2 enumerates,
    // with the ratio it computes against MUSTARD — the accent `/termo` will
    // ship and the worst of the four. `--ink-2` #6E6659 is 5.0791:1 on desk
    // paper and 5.3003:1 on card; `--ink` #211D19 is 15.0124:1 and 15.6663:1.
    const sites = [
      // 11px/600 kicker on desk paper — was 2.7311:1, now 5.0791:1.
      ["src/play/screen.module.css", ".titleKicker", "var(--ink-2)"],
      // 11px/400 kicker on desk paper — was 2.7311:1, now 5.0791:1.
      ["src/play/screen.module.css", ".barKicker", "var(--ink-2)"],
      // 11px label on card paper — was 2.8501:1, now 5.3003:1.
      ["src/play/screen.module.css", ".statLabel", "var(--ink-2)"],
      // 11px kicker on desk paper — was 2.7311:1, now 5.0791:1.
      ["src/play/conclusion-view.module.css", ".barKicker", "var(--ink-2)"],
      // 11px kicker on card paper — was 2.8501:1, now 5.3003:1.
      ["src/play/conclusion-view.module.css", ".cardKicker", "var(--ink-2)"],
      // The stamp's TEXT on card paper — was 2.8501:1, now 15.6663:1.
      ["src/play/conclusion-view.module.css", ".stamp", "var(--ink)"],
      // 17px/550 on the 10% chip tint #F5ECDA — was 2.5949:1, now 14.2637:1.
      [
        "src/play/conclusion-view.module.css",
        ".chipDone .chipName",
        "var(--ink)",
      ],
      // The hub card's kicker on card paper — a live AA failure on `main`
      // before this commit, at 2.8501:1. Now 5.3003:1.
      ["app/page.module.css", ".kicker", "var(--ink-2)"],
      // The done chip's TEXT on card paper — was 2.8501:1, now 15.6663:1.
      ["app/page.module.css", ".doneChip", "var(--ink)"],
    ] as const;

    for (const [sheet, selector, ink] of sites) {
      expect(
        decl(bodyOf(stylesheet(sheet), selector), "color"),
        `${sheet} ${selector}`,
      ).toBe(ink);
    }
  });

  it("keeps the two accent rings, which outline an already-legible label", () => {
    // ADR-0041 decision 5: an accent border that outlines a label carrying
    // the whole message is decoration, and WCAG 1.4.11's decorative
    // exemption applies. Both rings are 2.8501:1 against card paper and both
    // enclose text at 15.6663:1. Written down rather than left to be
    // rediscovered — and asserted, so "the text went neutral" cannot quietly
    // become "the accent left the screen".
    expect(
      decl(
        bodyOf(stylesheet("src/play/conclusion-view.module.css"), ".stamp"),
        "border",
      ),
    ).toBe("3px solid var(--accent)");
    expect(
      decl(bodyOf(stylesheet("app/page.module.css"), ".doneChip"), "border"),
    ).toBe("1.5px solid var(--accent)");
  });

  it("moves the hover accent from the word to the rule under it", () => {
    // ADR-0041 decision 4, and its ACCEPTED EXCEPTION. The word is `--ink`
    // (15.0124:1 on desk paper); the accent becomes a 2px underline, which
    // is 2.7311:1 on desk and 2.8501:1 on card — BELOW WCAG 1.4.11's 3:1
    // non-text floor. It is accepted on two grounds, neither of which is
    // "it complies": hover is a pointer-only affordance duplicating what the
    // link already carries at 15.0124:1, and a solid band appearing where
    // there was none is a change of GEOMETRY, so the state survives
    // greyscale. `:focus-visible`, which 2.4.7 and 1.4.11 do govern, is
    // `--ink` everywhere and rests on none of this.
    for (const sheet of [
      "src/play/screen.module.css",
      "src/play/conclusion-view.module.css",
    ] as const) {
      const body = bodyOf(stylesheet(sheet), ".page a:hover");
      expect(decl(body, "color"), sheet).toBe("var(--ink)");
      expect(decl(body, "text-decoration-color"), sheet).toBe("var(--accent)");
      expect(decl(body, "text-decoration-thickness"), sheet).toBe("2px");
    }
  });

  it("keeps the underline off the filled buttons it would otherwise reach", () => {
    // `.page a:hover` is (0,2,1) and `.cta`'s own `text-decoration: none` is
    // (0,1,0), so the decoration would land on every filled button on the
    // conclusion — the identical cascade the label colour already lost
    // (finding `chaining-cta-label-vanishes-on-hover`). The (0,3,0) opt-outs
    // that fixed the colour carry the decoration too, and the secondary link
    // moves the accent onto the rule it already HAS rather than stacking a
    // second one under it.
    const css = stylesheet("src/play/conclusion-view.module.css");

    for (const selector of [
      ".page .cta:hover",
      ".page .emptyCta:hover",
      ".page .secondaryLink:hover",
    ]) {
      expect(decl(bodyOf(css, selector), "text-decoration"), selector).toBe(
        "none",
      );
    }
    expect(
      decl(bodyOf(css, ".page .secondaryLink:hover"), "border-bottom-color"),
    ).toBe("var(--accent)");
  });
});
