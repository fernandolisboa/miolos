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
    // with their aria twins, the day row's composed sentence, the month's
    // sibling links, the day card's label, the play note, the result panel
    // and the metadata composers — all of it, in one block.
    expect(typeof copy.title).toBe("string");
    expect(typeof copy.lead).toBe("string");
    expect(typeof copy.empty).toBe("string");
    expect(typeof copy.recent.heading).toBe("string");
    expect(typeof copy.months.heading).toBe("string");
    expect(typeof copy.play.note).toBe("string");
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
    // Composed WHOLE in the module, never assembled in a component.
    expect(copy.dayRowAria("1 de agosto de 2026", ["Binairo", "Termo"])).toBe(
      "1 de agosto de 2026 — Binairo, Termo",
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
