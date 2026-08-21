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
    // `var(--accent)` on the day row's 3px rule and on the day card's border
    // and hard shadow — shapes, never words — and an unlisted sheet is
    // invisible to the whole automated ADR-0041 gate.
    "app/arquivo/arquivo.module.css",
    // #31: the late-result panel paints the game's accent on the completion
    // stamp's RING and nowhere else. It is the state CI can never scan, so
    // an unlisted sheet would leave it with no gate at all.
    "src/archive/late-result.module.css",
    // #31 step-6 F10b: the archive play note's own sheet. It paints the
    // game's accent on a left RULE — a shape — and nothing else, and it is
    // reachable in CI (an archived play route is scanned), but the list is
    // what makes the gate exhaustive rather than the scan.
    "src/archive/play-note.module.css",
    // #103: the share button's own sheet, split out of
    // `conclusion-view.module.css` so the archive's late-result panel can
    // render the same control without the conclusion's stylesheet. Its rules
    // are byte-unmoved and paint no accent at all — the button is app chrome,
    // `--line` and `--paper-card` — but they were inside a LISTED sheet until
    // this ticket, so leaving the new one off would silently narrow a gate
    // that has been over this CSS since #34.
    "src/play/share-button.module.css",
  ] as const;

  it("leaves no desk label on an accent fill, in any stylesheet", () => {
    // The non-vacuous half: a scan rather than a list, so a filled button
    // added later cannot reintroduce the pair without tripping this. Blocks
    // are split on `}` at a line start, which is the shape every rule in
    // every sheet in SHEETS has. ("these four sheets" was already stale at
    // seven when #31 found it — step-6 F22.)
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
    // consequence (c), as amended by ADR-0067). Every surface below can
    // render any of the four accents, so its fallback is the shipped
    // `var(--paper-desk)` — and since ADR-0067 deepened the termo accent,
    // desk is legal on every game's fill (4.8433:1 on #8D6212), so the
    // termo board's per-site `var(--ink)` value dissolved too. The column
    // stays because the mechanism is what allowed both states to exist.
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

  it("gives every game a light paper label — desk, with card for Nonogram — and nothing else", () => {
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
    // ADR-0067 (#161): desk on the deep mustard #8D6212 is 4.8433:1, so
    // Termo carries the family's light-label treatment. It carried
    // `var(--ink)` while the accent was the old #C08A1E, on which no paper
    // cleared 4.5 — the odd-one-out hub card #161 harmonized. ADR-0041
    // decision 2's range ("an ink legible on this accent", not "a paper
    // token") is unchanged; all four values happening to be papers is the
    // harmonization, not a narrowing of the range.
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

/**
 * The gate on ADR-0041: **an accent may colour a shape, never a word**.
 *
 * The sheets below are SHARED — every play screen and every conclusion
 * renders the first three with `--accent` bound to the game's own token, and
 * #29's stats sheet renders all four accents on one screen — so each of
 * them had to be legible against the worst of the four accents. When the
 * rule landed that was the old mustard #C08A1E at 2.7311:1 on desk and
 * 2.8501:1 on card (ADR-0067 has since deepened it to #8D6212); the worst
 * literal today, nonogram terracotta at 4.3182:1 on desk, still fails
 * PRODUCT.md's 4.5:1 text floor, and a shared `var(--accent)` has no fixed
 * value to measure at all — the rule does not rest on any one palette.
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
 * and therefore has to survive the worst of them, while a single-accent
 * per-game board or control module renders exactly one and its ratio can
 * simply be measured. **ADR-0041 consequence (h) enumerates all thirteen surviving
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
    // #31: the late-result panel paints the game's accent on the completion
    // stamp's RING and nowhere else. It is the state CI can never scan, so
    // an unlisted sheet would leave it with no gate at all.
    "src/archive/late-result.module.css",
    // #31 step-6 F10b: the archive play note, whose accent is a left RULE.
    "src/archive/play-note.module.css",
    // #103: the share button's sheet, now shared by the four daily
    // conclusions AND the archive's late-result panel — four game accents on
    // one set of rules, which is precisely the class this scan exists for. It
    // ships with ZERO accent-coloured text and its focus ring is `--ink`.
    "src/play/share-button.module.css",
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
   * fixed hex on every screen, never per game, so unlike `var(--accent)` it
   * has exactly one measurable ratio per paper; that is exactly the case
   * ADR-0041 decision 1 carves out. The hub pair is faithful to
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
    // Every row is one of the eleven declarations plan 022 §16.2 enumerates.
    // The per-row "was" figures are the conversion's own record, computed
    // against the OLD mustard #C08A1E — the worst accent at the time;
    // ADR-0067 has since deepened the token, and the neutral inks' figures
    // are paper-side and unmoved: `--ink-2` #6E6659 is 5.0791:1 on desk
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
      // 17px/550 on the 10% chip tint — was 2.5949:1 on the old mustard's
      // #F5ECDA; on ADR-0067's tint #F0E8D9 the ink is 13.7508:1.
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

  /**
   * Every per-game accent border in the shared sheets, ENUMERATED BY A SCAN
   * rather than by a list of instances (#96, ADR-0056 decision 4).
   *
   * ADR-0041 decision 5: an accent border that outlines a label carrying the
   * whole message is decoration, so WCAG 1.4.11's decorative exemption
   * applies; an accent border that is the only thing saying which state a
   * control is in is not. The decision states that RULE first and then names
   * two instances of it, so the enumeration is exemplary and a third instance
   * obeys it rather than falsifying it — but consequence (f) is explicit that
   * *"`impeccable detect` cannot see any of this and never will, so every
   * decision here is gated by one test file or by nothing"*, and `low-contrast`
   * provably never evaluates a border (both `contrastRatio(` call sites in
   * `impeccable@3.4.0` take a TEXT foreground). Hence a scan: a fifth ring in
   * a shared sheet reds here on arrival instead of joining the tree
   * unasserted, which is what the archive postmark did for the whole of #31.
   *
   * `var(--accent)` EXACTLY, and not `var(--accent[a-z-]*)`. `--accent-app` is
   * one fixed hex on every screen, never per game, and is ADR-0041 decision
   * 1's own carve-out; widening the pattern would sweep in four app-identity
   * rings — `conclusion-view.module.css .streakCard`, `page.module.css
   * .streakStamp`, `estatisticas/page.module.css .summary` and `.medalRing` —
   * whose ratios the `ALLOWED_ACCENT_TEXT` block above already records at
   * 6.0351:1 and 6.2980:1, and which are not this scan's business.
   *
   * The ratios, per ring and per PAPER, because the fourth ring does not sit
   * on the same paper as the other three. Worst case per ring since ADR-0067
   * is nonogram (termo's deep #8D6212 is 5.0542:1 on card / 4.8433:1 on
   * desk; the old mustard's 2.8501:1 / 2.7311:1 were the figures that made
   * the decorative exemption load-bearing rather than headroom):
   *
   * - `conclusion-view.module.css .stamp` — the daily's 3px postmark, ring
   *   4.5063:1 worst on `--paper-card`, enclosing `--ink` at 15.6663:1.
   * - `page.module.css .doneChip` — the hub's 1.5px chip, same paper, same
   *   two figures.
   * - `arquivo.module.css .doneChip` — #96's archive chip, same paper, same
   *   two figures.
   * - `late-result.module.css .stamp` — the archive's 3px postmark, on DESK
   *   paper: ring 4.3182:1 worst, enclosing `--ink` at 15.0124:1 (`.stampDay`) and
   *   `--ink-2` at 5.0791:1 (`.stampLabel`, `.stampMonth`). The lowest
   *   enclosed word here is 5.0791:1, above PRODUCT.md's 4.5 floor, so this
   *   ring outlines an already-legible label too — and it is `aria-hidden`
   *   besides, so it is decoration by construction as well as by ratio. It
   *   has been shipped and unasserted since #31.
   * - `screen.module.css .hint` — NOT a ring: an accent FILL whose border is
   *   its own edge (`background: var(--accent)`, `color: var(--ink-on-accent,
   *   var(--paper-desk))`). The same pattern matches it, and `T-WEB-S72` —
   *   the fill scan — is what gates it.
   */
  const ACCENT_BORDERS = new Map([
    ["src/play/conclusion-view.module.css .stamp", "3px solid var(--accent)"],
    ["app/page.module.css .doneChip", "1.5px solid var(--accent)"],
    ["app/arquivo/arquivo.module.css .doneChip", "1.5px solid var(--accent)"],
    ["src/archive/late-result.module.css .stamp", "3px solid var(--accent)"],
    ["src/play/screen.module.css .hint", "1.5px solid var(--accent)"],
  ]);

  it("enumerates every accent border in the shared sheets, and only those", () => {
    const found = new Map<string, string>();
    for (const sheet of SHARED) {
      for (const block of stylesheet(sheet).split(/^\}$/m)) {
        const border = decl(block, "border");
        if (
          border !== undefined &&
          /^[\d.]+px\s+solid\s+var\(--accent\)$/.test(border)
        ) {
          const selector = (/^\s*(\S.*?)\s*\{/m.exec(block) ?? [])[1] ?? "?";
          found.set(`${sheet} ${selector}`, border);
        }
      }
    }

    // The SET is what closes it: a sixth accent border in a shared sheet reds
    // this test rather than passing unnoticed.
    expect([...found.keys()].sort()).toEqual([...ACCENT_BORDERS.keys()].sort());
    // And each declaration by value, so "the text went neutral" cannot
    // quietly become "the accent left the screen".
    for (const [site, border] of ACCENT_BORDERS) {
      expect(found.get(site), site).toBe(border);
    }
  });

  it("keeps the ring scan non-vacuous, and keeps `--accent-app` out of it", () => {
    // A pattern that matched nothing would make the arm above a green over an
    // empty set.
    expect(ACCENT_BORDERS.size).toBe(5);
    expect(
      /^[\d.]+px\s+solid\s+var\(--accent\)$/.test("1.5px solid var(--accent)"),
    ).toBe(true);
    // The carve-out, asserted rather than described: the app-identity rings
    // really do declare `--accent-app`, and the pattern really does miss them.
    expect(
      /^[\d.]+px\s+solid\s+var\(--accent\)$/.test(
        "1.5px solid var(--accent-app)",
      ),
    ).toBe(false);
    expect(
      decl(
        bodyOf(
          stylesheet("src/play/conclusion-view.module.css"),
          ".streakCard",
        ),
        "border",
      ),
    ).toBe("1.5px solid var(--accent-app)");
  });

  it("moves the hover accent from the word to the rule under it", () => {
    // ADR-0041 decision 4, and its ACCEPTED EXCEPTION. The word is `--ink`
    // (15.0124:1 on desk paper); the accent becomes a 2px underline, whose
    // worst case was the old mustard at 2.7311:1 on desk / 2.8501:1 on card,
    // BELOW WCAG 1.4.11's 3:1 non-text floor (since ADR-0067 the worst is
    // nonogram at 4.3182:1, above it). The exception was accepted — and its
    // grounds are kept — on two grounds, neither of which is
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
    // (the 2px offset gap inside the ring, the page background outside it).
    // When the rule was converted the old mustard #C08A1E measured
    // **2.7311:1** there — below the floor: the accent ring passed only by
    // accident of WHICH three games shipped (nonogram 4.3182:1, binairo
    // 5.3066:1, sudoku 7.5113:1) and would have gone red the instant #27
    // added `termo` to `playRoutes` — the exact trigger ADR-0041 exists for
    // (step-7 finding A-F1). ADR-0067's deep value would pass today; ink
    // stays, because a shared ring's legality must not depend on the palette.
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
    // words without its substance: the state delta would have been `--line`
    // against the OLD mustard #C08A1E at **1.9899:1** and nothing else
    // (step-7 finding A-F5). Since ADR-0067 every accent clears 3:1 against
    // `--line` (the deep mustard is 3.5288:1), and the geometry delta is
    // kept because its grounds do not depend on the palette.
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
