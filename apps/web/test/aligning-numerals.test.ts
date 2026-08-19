import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { bodyOf, decl, stylesheet } from "./css-source";

/**
 * The gate on ADR-0036 (#63) — the face a column of numerals is rendered in.
 *
 * ADR-0036 measured, against the exact woff2 `next/font` ships, that Fraunces
 * responds to NO OpenType feature tag at all: `tnum`, `onum`, `smcp` and
 * `ss01` are byte-identical no-ops on it, while its `wght` and `opsz` axes are
 * live (that pair is the positive control — the file loads, the null result is
 * a property of the face). So `font-variant-numeric: tabular-nums` on
 * `var(--font-display)` asks for something the face cannot deliver, and the
 * running clock physically moved ≈6.1px per digit at 30px on every play
 * screen.
 *
 * Decision 1 is the rule: numerals that must align in a column ride
 * `var(--font-ui)` — Instrument Sans, every digit 6.609375px at 11px, spread
 * 0.000000. Decision 2 is the carve-out, and it is not an exception to be
 * squeezed: a SINGLE numeral that never lines up with another may stay on
 * Fraunces, where `tabular-nums` is inert rather than harmful.
 *
 * Why the assertions are on stylesheet TEXT rather than on a rendered box: the
 * test environment is jsdom, which implements no layout and loads no fonts, so
 * no rendering test in this suite can measure a glyph advance — the reason
 * `css-source.ts` exists at all (`ink-on-accent.test.ts` carries the same
 * paragraph). The real measurement is in ADR-0036 and was taken in a browser;
 * what lives here is the tripwire that stops the fix being undone silently.
 */
describe("numerals that align ride the UI face (T-WEB-S230)", () => {
  const SHEET = "src/play/screen.module.css";

  /**
   * The defect itself, at both bands. One readout, two sizes: `.timerBar` is
   * the ≤1140px top-bar clock and `.timerCard` the >1140px sidebar clock, and
   * `TimerReadout` renders BOTH on every play screen (one is hidden per
   * viewport). Neither media block re-declares the family, so the top-level
   * rule is the whole story.
   */
  it.each(["timerBar", "timerCard"] as const)(
    "renders the running clock's %s in the UI face with tabular figures",
    (klass) => {
      const body = bodyOf(stylesheet(SHEET), `.${klass}`);
      expect(
        decl(body, "font-family"),
        "Fraunces has no tabular figures — the clock shifts on every tick",
      ).toBe("var(--font-ui)");
      expect(decl(body, "font-variant-numeric")).toBe("tabular-nums");
    },
  );

  /**
   * The non-vacuous half: a SCAN over every stylesheet in the app rather than
   * a list of the ones known to be interesting. `ink-on-accent.test.ts`'s
   * hand-maintained list was already stale at seven sheets when #31 found it
   * (step-6 F22), so this walks the tree instead — a sheet added tomorrow is
   * covered without editing anything here.
   *
   * The pairing it hunts is the contradiction ADR-0036 names: a block that
   * asks for tabular figures AND sets the face that cannot produce them. Every
   * such block is either the defect or decision 2's sanctioned case, and the
   * allow-list below is the exhaustive record of the second kind.
   */
  it("pairs tabular-nums with the display face only where ADR-0036 sanctions it", () => {
    /**
     * Decision 2's cases, each with the reason it is a SINGLE non-aligning
     * numeral. Adding a row here is a decision, not a formality: it is the
     * claim that the numeral in it never has to line up with another.
     */
    const SANCTIONED = new Map<string, string>([
      [
        "src/binairo/binairo-screen.module.css .cell",
        "one centred glyph per board cell — per-digit advance never accumulates (ADR-0036 (e))",
      ],
      [
        "src/sudoku/sudoku-board.module.css .cell",
        "one centred glyph per board cell — same case as Binairo's",
      ],
      [
        "app/page.module.css .streakNumeral",
        "the hub's streak stamp — decision 2's named example, `--text-numeral-lg`",
      ],
      [
        "src/play/conclusion-view.module.css .stampTime",
        "the conclusion's completion time, a FROZEN value: it is painted once and never ticks, so no digit ever changes under its neighbours",
      ],
    ]);

    const offenders: string[] = [];
    for (const sheet of sheets()) {
      const css = stylesheet(sheet);
      // Leaf rules only — `[^{}]` cannot cross a brace, so an `@media`
      // prelude never swallows the rules nested inside it and a family set in
      // one rule is never read against a feature set in another.
      for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        // `?? ""` only to satisfy `noUncheckedIndexedAccess`: both groups are
        // unconditional in the pattern, so neither can be undefined on a match.
        const prelude = rule[1] ?? "";
        const body = rule[2] ?? "";
        const asksForTabular = /font-variant-numeric:\s*tabular-nums/.test(
          body,
        );
        if (!onDisplayFace(body) || !asksForTabular) {
          continue;
        }
        const site = `${sheet} ${prelude.trim().replace(/\s+/g, " ")}`;
        if (!SANCTIONED.has(site)) {
          offenders.push(site);
        }
      }
    }

    expect(
      offenders,
      "tabular-nums is a measured no-op on Fraunces (ADR-0036); a column of figures belongs on var(--font-ui)",
    ).toEqual([]);
  });

  /**
   * The allow-list's own tripwire. Without it the scan above degrades
   * silently: delete `.stampTime` from the sheet and the entry becomes an
   * assertion about nothing, which is the shape a scan-plus-list gate fails
   * in.
   */
  it("keeps every sanctioned Fraunces numeral real", () => {
    for (const [sheet, klass] of [
      ["src/binairo/binairo-screen.module.css", ".cell"],
      ["src/sudoku/sudoku-board.module.css", ".cell"],
      // Reached through `font: var(--text-numeral-lg)`, which is why the scan
      // above resolves the token indirection instead of grepping for the
      // custom property by name.
      ["app/page.module.css", ".streakNumeral"],
      ["src/play/conclusion-view.module.css", ".stampTime"],
    ] as const) {
      expect(
        onDisplayFace(bodyOf(stylesheet(sheet), klass)),
        `${sheet} ${klass} is allow-listed but no longer on the display face`,
      ).toBe(true);
    }
  });
});

/**
 * Whether a rule body puts its text on Fraunces — directly, or through one of
 * `packages/ui/tokens.css`'s composite `--text-*` shorthands.
 *
 * The indirection is not hypothetical: the hub's `.streakNumeral` reaches the
 * display face as `font: var(--text-numeral-lg)` and never names
 * `--font-display` at all, so a scan that grepped for the custom property
 * would read decision 2's own named example as a rule about nothing. The token
 * set is derived from `tokens.css` at run time rather than listed here, so a
 * new display-face token is covered the day it lands.
 */
function onDisplayFace(body: string): boolean {
  if (/var\(--font-display\)/.test(body)) {
    return true;
  }
  return DISPLAY_FACE_TOKENS.some((name) =>
    new RegExp(`var\\(${name}\\)`).test(body),
  );
}

const DISPLAY_FACE_TOKENS: readonly string[] = (() => {
  const tokens = stylesheet("../../packages/ui/tokens.css");
  const names = [...tokens.matchAll(/(--text-[\w-]+)\s*:\s*([^;]+);/g)].flatMap(
    (match) => {
      const name = match[1];
      const value = match[2];
      // Both groups are unconditional in the pattern; the guard is what
      // `noUncheckedIndexedAccess` wants to see rather than a real branch.
      if (name === undefined || value === undefined) {
        return [];
      }
      return value.includes("var(--font-display)") ? [name] : [];
    },
  );
  // `--text-card-title`, `--text-screen-title`, `--text-numeral-lg` today. A
  // zero-length list would make `onDisplayFace` blind to every token user, so
  // it fails the file rather than the assertion — this runs at import time,
  // where `expect` has no test to attach to.
  if (names.length === 0) {
    throw new Error("no --text-* token resolves to var(--font-display)");
  }
  return names;
})();

/** Every stylesheet the app ships, repo-relative to `apps/web/`. */
function sheets(): readonly string[] {
  const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const found: string[] = [];
  for (const root of ["src", "app"]) {
    for (const entry of readdirSync(path.join(web, root), {
      recursive: true,
      withFileTypes: true,
    })) {
      if (entry.isFile() && entry.name.endsWith(".css")) {
        found.push(path.relative(web, path.join(entry.parentPath, entry.name)));
      }
    }
  }
  // A guard against the walk silently finding nothing — the failure mode that
  // would make the scan above pass for the wrong reason.
  expect(found.length).toBeGreaterThan(10);
  return found;
}
