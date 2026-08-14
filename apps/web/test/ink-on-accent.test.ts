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
  /** Every sheet in the app that paints a `var(--accent)` background —
   *  #29's stats sheet included: its histogram bars, distribution bars and
   *  washi tape all paint the accent. */
  const SHEETS = [
    "src/play/screen.module.css",
    "src/play/conclusion-view.module.css",
    "app/page.module.css",
    "src/nonogram/nonogram-board.module.css",
    "app/estatisticas/page.module.css",
    // #31 (ADR-0053): the archive's three read-only surfaces. It paints
    // `var(--accent)` on the day row's 2px rule and on the day card's border
    // and hard shadow — shapes, never words — and an unlisted sheet is
    // invisible to the whole automated ADR-0041 gate.
    "app/arquivo/arquivo.module.css",
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
 * The sheets below are SHARED — every play screen and every conclusion
 * renders the first three with `--accent` bound to the game's own token, and
 * #29's stats sheet renders all four accents on one screen — so each of
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
 * The scan reads `var(--accent…)` in EVERY form, the per-game literals
 * `var(--accent-termo)` / `var(--accent-binairo)` and the app's
 * `var(--accent-app)` included. The `var(--accent)`-only regex it replaces
 * was a hole the Termo module #27 adds would have walked straight through,
 * and `app/page.module.css` — on the SHARED list below — was already through
 * it with two `color: var(--accent-app)` declarations (step-7 finding A-F3).
 *
 * It is scoped to the SHARED sheets, and that scope is the whole of
 * ADR-0041 decision 1's exception: a shared sheet renders all four accents
 * and therefore has to survive mustard, while a single-accent per-game
 * board or control module renders exactly one and its ratio can simply be
 * measured. **ADR-0041 consequence (h) enumerates all thirteen surviving
 * accent-coloured declarations with their measured ratios** — the list lives
 * there rather than being copied here, where the copy would go stale (the
 * one that used to sit in this comment said "five" and named four, omitting
 * Binairo's own four entirely — step-7 finding A-F7).
 */
describe("accents colour shapes, never words (T-WEB-S73)", () => {
  /** The sheets every game renders, and the only ones ADR-0041 §3
   *  converts — plus #29's stats sheet, which renders all four game
   *  accents on one screen and is therefore exactly the class of sheet
   *  this scan exists for (it ships with ZERO accent-coloured text, and
   *  this is the tripwire that keeps it so). */
  const SHARED = [
    "src/play/screen.module.css",
    "src/play/conclusion-view.module.css",
    "app/page.module.css",
    "app/estatisticas/page.module.css",
    // #31: the archive renders whichever accent a day's games supply — up to
    // all four on one row — so it is exactly the class of sheet this scan
    // exists for, and it ships with ZERO accent-coloured text.
    "app/arquivo/arquivo.module.css",
  ] as const;

  /**
   * The four declarations the scan below is allowed to see, named one by one
   * rather than left to a hole in the regex.
   *
   * All four are the app accent `--accent-app` #9E3B2F (L 0.10602266).
   * The hub pair sits on `--paper-desk` #F7F2E9 (L 0.89161610) —
   * `.streakStamp` paints desk paper — i.e. (0.89161610 + 0.05) /
   * (0.10602266 + 0.05) = **6.0351:1**; the conclusion pair (#19,
   * ADR-0048's amendment to ADR-0041 consequence (h)) sits on
   * `--paper-card` #FBF7EF, ADR-0041 decision 1's own recorded
   * **6.2980:1**. Both clear PRODUCT.md's 4.5 floor. `--accent-app` is one
   * fixed hex on every screen, never per game, so it cannot become mustard
   * the way `var(--accent)` can; that is exactly the case ADR-0041
   * decision 1 carves out. The hub pair is faithful to
   * `f1-hoje-desktop.dc.html:23-24` and the conclusion pair to
   * `f5-conclusao-desktop.dc.html:55-56` — the streak is the app's one
   * piece of first-party identity on both screens.
   */
  const ALLOWED_ACCENT_TEXT = new Set([
    "app/page.module.css .streakNumeral",
    "app/page.module.css .streakLabel",
    "src/play/conclusion-view.module.css .streakCardNumeral",
    "src/play/conclusion-view.module.css .streakCardLabel",
  ]);

  it("declares no accent-coloured text in the shared sheets, beyond the two allowed", () => {
    // A scan, not a list, so the eleven conversions cannot be undone one at a
    // time and a twelfth site cannot be added. Anchored on a line start or a
    // `;` so `border-color:` and `text-decoration-color:` — both SHAPES, both
    // sanctioned by decision 1 — are not swept up by a substring match.
    //
    // `var\(--accent[a-z-]*\)` and not `var\(--accent\)`: the literal closing
    // paren matched the shared token alone and was blind to
    // `var(--accent-app)`, `var(--accent-termo)` and `var(--accent-binairo)`
    // (step-7 finding A-F3).
    const offenders: string[] = [];
    for (const sheet of SHARED) {
      const css = stylesheet(sheet);
      for (const block of css.split(/^\}$/m)) {
        if (/(?:^|;)\s*color:\s*var\(--accent[a-z-]*\)/m.test(block)) {
          const site = `${sheet} ${(/^\s*(\S.*?)\s*\{/m.exec(block) ?? [])[1] ?? "?"}`;
          if (!ALLOWED_ACCENT_TEXT.has(site)) {
            offenders.push(site);
          }
        }
      }
    }
    expect(
      offenders,
      "ADR-0041: an accent may colour a shape, never a word",
    ).toEqual([]);
  });

  it("keeps the allow-list non-vacuous", () => {
    // Four dead strings would quietly cover a future offender that happened
    // to reuse a selector. Every entry above has to name a declaration that
    // exists and carries the accent the exception was measured for.
    for (const selector of [".streakNumeral", ".streakLabel"]) {
      expect(
        decl(bodyOf(stylesheet("app/page.module.css"), selector), "color"),
        selector,
      ).toBe("var(--accent-app)");
      expect(ALLOWED_ACCENT_TEXT.has(`app/page.module.css ${selector}`)).toBe(
        true,
      );
    }
    for (const selector of [".streakCardNumeral", ".streakCardLabel"]) {
      expect(
        decl(
          bodyOf(stylesheet("src/play/conclusion-view.module.css"), selector),
          "color",
        ),
        selector,
      ).toBe("var(--accent-app)");
      expect(
        ALLOWED_ACCENT_TEXT.has(
          `src/play/conclusion-view.module.css ${selector}`,
        ),
      ).toBe(true);
    }
    expect(ALLOWED_ACCENT_TEXT.size).toBe(4);
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
    // greyscale. `:focus-visible`, which 2.4.7 and 1.4.11 DO govern, rests on
    // none of this: the only one this shared layer declares is `--ink`, pinned
    // by the assertion below.
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

  it("paints the shared layer's one focus ring in ink, never the accent", () => {
    // The claim the hover exception above rests on, asserted instead of
    // stated. `.hint` is the ONLY focus indicator the shared play layer
    // declares, and unlike hover it is not a pointer-only affordance — it is
    // the whole of what tells a keyboard user where they are, so WCAG 1.4.11's
    // 3:1 non-text floor and 2.4.7 both bind.
    //
    // `var(--accent)` here is per game and BOTH neighbours are `--paper-desk`
    // (the 2px offset gap inside the ring, the page background outside it), so
    // mustard #C08A1E (L 0.29477163) on desk #F7F2E9 (L 0.89161610) is
    // (0.89161610 + 0.05) / (0.29477163 + 0.05) = **2.7311:1** — below the
    // floor. It passed only by accident of WHICH three games shipped
    // (nonogram 4.3182:1, binairo 5.3066:1, sudoku 7.5113:1) and would have
    // gone red the instant #27 added `termo` to `playRoutes` — the exact
    // trigger ADR-0041 exists for (step-7 finding A-F1).
    //
    // `--ink` #211D19 (L 0.01272250) is (0.89161610 + 0.05) /
    // (0.01272250 + 0.05) = **15.0124:1** for all four.
    // `nonogram-board.module.css:444-446` already ships this exact rule for
    // its own `.control`, so it is a precedent rather than an invention.
    const body = bodyOf(
      stylesheet("src/play/screen.module.css"),
      ".hint:focus-visible",
    );

    expect(decl(body, "outline")).toBe("2px solid var(--ink)");
    expect(decl(body, "outline-offset")).toBe("2px");
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

  it("gives the secondary link's hover a real geometry delta", () => {
    // ADR-0041 decision 4's exception is granted to "a solid band appearing
    // where there was none... a change of GEOMETRY". This link already HAD its
    // rule, so a bare `border-bottom-color` swap inherited the exception's
    // words without its substance: the state delta would be `--line` #D8D0C2
    // (L 0.63605722) against mustard #C08A1E (L 0.29477163) =
    // (0.63605722 + 0.05) / (0.29477163 + 0.05) = **1.9899:1** and nothing
    // else (step-7 finding A-F5).
    //
    // 2px -> 3px is the delta, and the padding gives the pixel back through
    // the same custom property, so the box is 6px below the baseline in both
    // states and hovering never reflows the column the link is centred in.
    const css = stylesheet("src/play/conclusion-view.module.css");
    const rest = bodyOf(css, ".secondaryLink");

    expect(decl(rest, "--rule-width")).toBe("2px");
    expect(decl(rest, "border-bottom")).toBe(
      "var(--rule-width) solid var(--line)",
    );
    expect(decl(rest, "padding-bottom")).toBe("calc(6px - var(--rule-width))");
    expect(
      decl(bodyOf(css, ".page .secondaryLink:hover"), "--rule-width"),
    ).toBe("3px");
  });

  it("keeps the game kicker branded, not a generic section eyebrow", () => {
    // ADR-0041 consequence (d) rests the whole identity argument on "an 11px
    // uppercase 0.16em kicker" still reading as a kicker once the colour
    // leaves. Both shared `.barKicker` rules shipped 11px/400/0.14em, which is
    // every property of `conclusion-view`'s `.dayCardTitle` — a generic
    // section eyebrow — so on the primary form factor the two were
    // indistinguishable and the accent had been the only thing telling them
    // apart. At <=1140px `.titleKicker` and `.cardKicker` are `display: none`,
    // so `.barKicker` is the sole carrier of game identity there (step-7
    // finding A-F6). `--text-kicker` is `600 11px/1 var(--font-ui)`.
    for (const sheet of [
      "src/play/screen.module.css",
      "src/play/conclusion-view.module.css",
    ] as const) {
      const body = bodyOf(stylesheet(sheet), ".barKicker");
      expect(decl(body, "font"), sheet).toBe("var(--text-kicker)");
      expect(decl(body, "letter-spacing"), sheet).toBe("0.16em");
    }

    // ...and from the other side: the generic eyebrow stays plain, so the two
    // treatments cannot re-converge by the eyebrow drifting up to meet them.
    const eyebrow = bodyOf(
      stylesheet("src/play/conclusion-view.module.css"),
      ".dayCardTitle",
    );
    expect(decl(eyebrow, "font")).toBeUndefined();
    expect(decl(eyebrow, "font-size")).toBe("11px");
    expect(decl(eyebrow, "letter-spacing")).toBe("0.14em");
  });
});
