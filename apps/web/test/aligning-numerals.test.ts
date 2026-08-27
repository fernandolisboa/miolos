import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { bodyOf, decl, stylesheet } from "./css-source";

describe("numerals that align ride the UI face (T-WEB-S230)", () => {
  const SHEET = "src/play/screen.module.css";

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

  it("pairs tabular-nums with the display face only where ADR-0036 sanctions it", () => {
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

      for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
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

  it("keeps every sanctioned Fraunces numeral real", () => {
    for (const [sheet, klass] of [
      ["src/binairo/binairo-screen.module.css", ".cell"],
      ["src/sudoku/sudoku-board.module.css", ".cell"],

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

      if (name === undefined || value === undefined) {
        return [];
      }
      return value.includes("var(--font-display)") ? [name] : [];
    },
  );

  if (names.length === 0) {
    throw new Error("no --text-* token resolves to var(--font-display)");
  }
  return names;
})();

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

  expect(found.length).toBeGreaterThan(10);
  return found;
}
