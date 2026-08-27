import { describe, expect, it } from "vitest";

import { accentVars } from "../src/play/accent";
import { bodyOf, decl, stylesheet } from "./css-source";

describe("the ink on an accent fill (T-WEB-S72)", () => {
  const SHEETS = [
    "src/play/screen.module.css",
    "src/play/conclusion-view.module.css",
    "app/page.module.css",
    "src/nonogram/nonogram-board.module.css",
    "app/estatisticas/page.module.css",

    "app/arquivo/arquivo.module.css",

    "src/archive/late-result.module.css",

    "src/archive/play-note.module.css",

    "src/play/share-button.module.css",
  ] as const;

  it("leaves no desk label on an accent fill, in any stylesheet", () => {
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
    //

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
    const css = stylesheet("src/play/conclusion-view.module.css");

    expect(decl(bodyOf(css, ".page .cta:hover"), "color")).toBe(
      "var(--paper-desk)",
    );
    expect(css).toMatch(/^\.page \.cta\.ctaNext:hover \{/m);

    expect(css).not.toMatch(/^\.page \.ctaNext:hover \{/m);
  });

  it("gives every game a light paper label — desk, with card for Nonogram — and nothing else", () => {
    expect(accentVars("binairo")).toEqual({
      "--accent": "var(--accent-binairo)",
      "--ink-on-accent": "var(--paper-desk)",
    });
    expect(accentVars("sudoku")).toEqual({
      "--accent": "var(--accent-sudoku)",
      "--ink-on-accent": "var(--paper-desk)",
    });

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

describe("accents colour shapes, never words (T-WEB-S73)", () => {
  const SHARED = [
    "src/play/screen.module.css",
    "src/play/conclusion-view.module.css",
    "app/page.module.css",
    "app/estatisticas/page.module.css",

    "app/arquivo/arquivo.module.css",

    "src/archive/late-result.module.css",

    "src/archive/play-note.module.css",

    "src/play/share-button.module.css",

    "src/play/push-prompt-card.module.css",

    "src/play/conclusion-lazy.module.css",
  ] as const;

  const ALLOWED_ACCENT_TEXT = new Set([
    "app/page.module.css .streakNumeral",
    "app/page.module.css .streakLabel",
    "src/play/conclusion-view.module.css .streakCardNumeral",
    "src/play/conclusion-view.module.css .streakCardLabel",
  ]);

  it("declares no accent-coloured text in the shared sheets, beyond the two allowed", () => {
    //

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

  it("keeps the lazy conclusion's two frames free of every accent token", () => {
    const css = stylesheet("src/play/conclusion-lazy.module.css");

    expect(
      /var\(\s*--accent[a-z-]*[,)]/.exec(css)?.[0],
      "the transient and degraded frames are paper, line and ink only",
    ).toBeUndefined();

    expect(css).toContain(".stamp");
    expect(stylesheet("src/archive/late-result.module.css")).toMatch(
      /var\(\s*--accent[a-z-]*[,)]/,
    );
    expect("border: 3px solid var(--accent, var(--ink))").toMatch(
      /var\(\s*--accent[a-z-]*[,)]/,
    );
  });

  it("paints the eleven converted sites in a neutral ink", () => {
    const sites = [
      ["src/play/screen.module.css", ".titleKicker", "var(--ink-2)"],

      ["src/play/screen.module.css", ".barKicker", "var(--ink-2)"],

      ["src/play/screen.module.css", ".statLabel", "var(--ink-2)"],

      ["src/play/conclusion-view.module.css", ".barKicker", "var(--ink-2)"],

      ["src/play/conclusion-view.module.css", ".cardKicker", "var(--ink-2)"],

      ["src/play/conclusion-view.module.css", ".stamp", "var(--ink)"],

      [
        "src/play/conclusion-view.module.css",
        ".chipDone .chipName",
        "var(--ink)",
      ],

      ["app/page.module.css", ".kicker", "var(--ink-2)"],

      ["app/page.module.css", ".doneChip", "var(--ink)"],
    ] as const;

    for (const [sheet, selector, ink] of sites) {
      expect(
        decl(bodyOf(stylesheet(sheet), selector), "color"),
        `${sheet} ${selector}`,
      ).toBe(ink);
    }
  });

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

    expect([...found.keys()].sort()).toEqual([...ACCENT_BORDERS.keys()].sort());

    for (const [site, border] of ACCENT_BORDERS) {
      expect(found.get(site), site).toBe(border);
    }
  });

  it("keeps the ring scan non-vacuous, and keeps `--accent-app` out of it", () => {
    expect(ACCENT_BORDERS.size).toBe(5);
    expect(
      /^[\d.]+px\s+solid\s+var\(--accent\)$/.test("1.5px solid var(--accent)"),
    ).toBe(true);

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
    //

    //

    const body = bodyOf(
      stylesheet("src/play/screen.module.css"),
      ".hint:focus-visible",
    );

    expect(decl(body, "outline")).toBe("2px solid var(--ink)");
    expect(decl(body, "outline-offset")).toBe("2px");
  });

  it("keeps the underline off the filled buttons it would otherwise reach", () => {
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
    //

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
    for (const sheet of [
      "src/play/screen.module.css",
      "src/play/conclusion-view.module.css",
    ] as const) {
      const body = bodyOf(stylesheet(sheet), ".barKicker");
      expect(decl(body, "font"), sheet).toBe("var(--text-kicker)");
      expect(decl(body, "letter-spacing"), sheet).toBe("0.16em");
    }

    const eyebrow = bodyOf(
      stylesheet("src/play/conclusion-view.module.css"),
      ".dayCardTitle",
    );
    expect(decl(eyebrow, "font")).toBeUndefined();
    expect(decl(eyebrow, "font-size")).toBe("11px");
    expect(decl(eyebrow, "letter-spacing")).toBe("0.14em");
  });
});
