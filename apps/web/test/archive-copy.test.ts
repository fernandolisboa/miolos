import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { messages } from "../src/i18n";

// The archive's copy (#31, ADR-0018 :15 / ADR-0053). Every archive string
// lives in `messages.archive`, no archive component carries a literal, and
// `ConclusionCopy`'s shape is byte-unchanged — the archive composes its own
// `messages.archive.result` block instead of widening it (ADR-0043 D8).

/** The archive's own modules: the app segment plus `src/archive`. */
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

/** Source with its comments removed — prose is not code. */
function code(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/^[ \t]*\/\/.*$/gm, "")
    .replaceAll(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

describe("the archive's copy lives in messages.archive (T-WEB-S181)", () => {
  it("every archive string is reachable from messages.archive", () => {
    const copy = messages.archive;
    // The chrome, the sections, the empty state, the three back affordances
    // with their aria twins, the calendar cell's composed name, the month's
    // sibling links, the day card's label, the play note, the result panel
    // and the metadata composers — all of it, in one block.
    expect(typeof copy.title).toBe("string");
    expect(typeof copy.lead).toBe("string");
    expect(typeof copy.empty).toBe("string");
    expect(typeof copy.months.heading).toBe("string");
    expect(typeof copy.play.note).toBe("string");
    // The calendar's two weekday tuples (#163): Sunday-first, seven
    // strings each, indexed by the grid's 0-Sunday column. (`recent.heading`
    // and `dayRowAria` went with the day rows the calendar replaced.)
    expect(copy.calendar.weekdays).toHaveLength(7);
    expect(copy.calendar.weekdaysLong).toHaveLength(7);
    for (const tuple of [copy.calendar.weekdays, copy.calendar.weekdaysLong]) {
      for (const weekday of tuple) {
        expect(typeof weekday).toBe("string");
        expect(weekday.length).toBeGreaterThan(0);
      }
    }
    // BOTH tuples in full, every index (step-6 correctness N1): the grid
    // indexes them by COLUMN, so a pair swapped in the middle — terça for
    // quarta — would ship a wrong weekday in every affected cell's
    // accessible name with nothing else red. Sunday-first is the whole
    // convention, and only the literal order states it.
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
    // FIVE notes, one per state the device can distinguish (step-6
    // F3/F16), plus the two outcome titles, the stamp's label and the
    // archived Termo's word lead (F7, F23).
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
    // The day card's three accessible names and its two chip words (#96).
    // Additive by choice: `copy.day` carries no exact key-list assertion, so
    // nothing above is a closed list this had to be added to.
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
    // Composed WHOLE in the module, never assembled in a component — the
    // calendar cell's name leads with the visible numeral's long date
    // (WCAG 2.5.3) and closes with the weekday, the one fact the
    // aria-hidden header withholds.
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
      // A pt-BR sentence is the thing being banned, and the cheapest
      // mechanical proxy for one is a quoted run containing a Portuguese
      // accented character — the class every string in `messages.archive`
      // belongs to and no identifier, class name or path does.
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
    // ADR-0043 decision 8: the archive's result panel is a NEW block, not a
    // third optional member on the conclusion's copy contract. Asserted
    // structurally, over the game whose conclusion carries the most.
    expect(Object.keys(messages.games.binairo.conclusion).sort()).toEqual([
      "kicker",
      "notYet",
      "title",
    ]);
    expect(Object.keys(messages.conclusion.sync).sort()).toEqual([
      "pending",
      "rejected",
    ]);
    // And the archive's own pending string is NOT the conclusion's: the
    // shipped one names connectivity, and a rate cap is not connectivity.
    expect(messages.archive.result.pending).not.toBe(
      messages.conclusion.sync.pending,
    );
  });
});

/**
 * T-WEB-S222 (#96, plan 043 D3/R14, ADR-0056 decision 2). The day card's chip
 * words ARE the hub's — one word, one register, one definition — and the
 * assertion has to red on both ways that can stop being true.
 *
 * The IDENTITY arms catch a re-point: one block edited to carry its own
 * literal while the other keeps the const. The VALUE arms catch a rename that
 * moves both surfaces together, which is the failure a cross-block comparison
 * alone cannot see — `copy.day.done === messages.hoje.done` is one binding
 * compared with itself, and stays green while `Feito` silently becomes
 * `Concluído` everywhere.
 *
 * The two overlap, and that is stated rather than dressed up as four
 * independent facts: with both value arms present a re-point already reds
 * one of them. The identity arms are kept because they are the ones that
 * still say "one definition" on the day the literal is deliberately changed
 * — the reversal ADR-0056 decision 2 describes, which must be a decision that
 * edits this test and never a drift that slips past it.
 */
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
    // `messages.ts` documents a deliberate split for this one word across two
    // registers — the chip's capitalised `Jogado` against a tabular value
    // slot's lowercase `jogado` (plan 022 §15.3). The chip joining the
    // capitalised side is what this ticket does; the split itself is
    // untouched, and this arm is what says so.
    expect(messages.archive.day.played).not.toBe(
      messages.archive.day.played.toLowerCase(),
    );
  });
});
