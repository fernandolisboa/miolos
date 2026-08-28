import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { messages } from "../src/i18n";

function archiveSources(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (/\.tsx?$/.test(entry.name)) {
        found.push(path);
      }
    }
  };
  walk(join(import.meta.dirname, "..", "app", "arquivo"));
  walk(join(import.meta.dirname, "..", "src", "archive"));
  return found;
}

function code(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/^[ \t]*\/\/.*$/gm, "")
    .replaceAll(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

describe("the archive's copy lives in messages.archive (T-WEB-S181)", () => {
  it("every archive string is reachable from messages.archive", () => {
    const copy = messages.archive;

    expect(typeof copy.title).toBe("string");
    expect(typeof copy.lead).toBe("string");
    expect(typeof copy.empty).toBe("string");
    expect(typeof copy.months.heading).toBe("string");
    expect(typeof copy.play.note).toBe("string");

    expect(copy.calendar.weekdays).toHaveLength(7);
    expect(copy.calendar.weekdaysLong).toHaveLength(7);
    for (const tuple of [copy.calendar.weekdays, copy.calendar.weekdaysLong]) {
      for (const weekday of tuple) {
        expect(typeof weekday).toBe("string");
        expect(weekday.length).toBeGreaterThan(0);
      }
    }

    expect([...copy.calendar.weekdays]).toEqual([
      "dom",
      "seg",
      "ter",
      "qua",
      "qui",
      "sex",
      "sáb",
    ]);
    expect([...copy.calendar.weekdaysLong]).toEqual([
      "domingo",
      "segunda-feira",
      "terça-feira",
      "quarta-feira",
      "quinta-feira",
      "sexta-feira",
      "sábado",
    ]);

    expect(Object.keys(copy.result).sort()).toEqual([
      "already",
      "late",
      "lostTitle",
      "notStored",
      "pending",
      "rejected",
      "stampLabel",
      "wonTitle",
      "wordLead",
    ]);
    expect(Object.keys(copy.meta).sort()).toEqual([
      "dayDescription",
      "dayTitle",
      "gameDescription",
      "gameTitle",
      "indexDescription",
      "indexTitle",
      "monthDescription",
      "monthTitle",
    ]);

    expect(copy.day.cardAria("Sudoku", "1 de agosto de 2026")).toBe(
      "Jogar Sudoku de 1 de agosto de 2026",
    );
    expect(copy.day.cardAriaDone("Sudoku", "1 de agosto de 2026")).toBe(
      "Ver o resultado do Sudoku de 1 de agosto de 2026",
    );
    expect(copy.day.cardAriaPlayed("Termo", "1 de agosto de 2026")).toBe(
      "Ver o resultado do Termo de 1 de agosto de 2026 — jogado",
    );
    expect(typeof copy.day.done).toBe("string");
    expect(typeof copy.day.played).toBe("string");

    expect(copy.calendar.dayAria("15 de agosto de 2026", "sábado")).toBe(
      "15 de agosto de 2026 — sábado",
    );
    expect(copy.backToDay("1 de agosto de 2026")).toBe("← 1 de agosto de 2026");
    expect(copy.backToIndex).toBe("← Arquivo");
  });

  it("no archive component carries a pt-BR literal", () => {
    const offenders: string[] = [];
    for (const path of archiveSources()) {
      const source = code(readFileSync(path, "utf8"));

      if (/(["'`])[^"'`]*[áàâãéêíóôõúüç][^"'`]*\1/i.test(source)) {
        offenders.push(path);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the scan is not vacuous — it catches a planted literal", () => {
    expect(
      /(["'`])[^"'`]*[áàâãéêíóôõúüç][^"'`]*\1/i.test(
        'const title = "Conclusão tardia";',
      ),
    ).toBe(true);
    expect(archiveSources().length).toBeGreaterThan(4);
  });

  it("ConclusionCopy's shape is byte-unchanged — the archive widened nothing", () => {
    expect(Object.keys(messages.games.binairo.conclusion).sort()).toEqual([
      "kicker",
      "notYet",
      "title",
    ]);
    expect(Object.keys(messages.conclusion.sync).sort()).toEqual([
      "pending",
      "rejected",
    ]);

    expect(messages.archive.result.pending).not.toBe(
      messages.conclusion.sync.pending,
    );
  });
});

describe("the archive chip wears the hub's own words (T-WEB-S222)", () => {
  it("points both registers at one definition", () => {
    expect(messages.archive.day.done).toBe(messages.hoje.done);
    expect(messages.archive.day.played).toBe(messages.hoje.played);
  });

  it("pins the words themselves, so a rename cannot move both silently", () => {
    expect(messages.hoje.done).toBe("Feito");
    expect(messages.archive.day.done).toBe("Feito");
    expect(messages.hoje.played).toBe("Jogado");
    expect(messages.archive.day.played).toBe("Jogado");
  });

  it("keeps the day ROW's lowercase tabular register split, as shipped", () => {
    expect(messages.archive.day.played).not.toBe(
      messages.archive.day.played.toLowerCase(),
    );
  });
});
