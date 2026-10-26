import { describe, expect, it } from "vitest";

import { bodyOf, decl, stylesheet } from "./css-source";

const ANGLE = /^-?\d+(\.\d+)?deg$/;
const ROTATION = /^rotate\(-?\d+(\.\d+)?deg\)$/;
const TAPE = /^(translateX\(-50%\) )?rotate\(-?[3-5]deg\)$/;
const CYCLE = [1, 2, 3, 4, 5, 6] as const;

function trackCount(css: string): number {
  const match = /^repeat\((\d+), 1fr\)$/.exec(
    decl(bodyOf(css, ".games"), "grid-template-columns") ?? "",
  );
  return Number(match?.[1]);
}

function columnStart(value: string | undefined): number {
  const match = /^(\d+) \/ span 2$/.exec(value ?? "");
  if (match === null) {
    throw new Error(`\`${String(value)}\` is not a start over two tracks`);
  }
  return Number(match[1]);
}

// Sparse auto-placement: a card takes two tracks from the cursor, or from the
// start a rule pins, and wraps to a new row when that start is behind it.
function rowCentres(
  count: number,
  tracks: number,
  pinned: (index: number, count: number) => number | undefined,
): number[] {
  let row: number[] = [];
  const rows = [row];
  let cursor = 1;
  for (let index = 1; index <= count; index += 1) {
    const pin = pinned(index, count);
    let start = pin ?? cursor;
    if (start < cursor || start + 1 > tracks) {
      row = [];
      rows.push(row);
      start = pin ?? 1;
    }
    row.push(start + 0.5);
    cursor = start + 2;
  }
  return rows.map(
    (centres) =>
      centres.reduce((sum, centre) => sum + centre, 0) / centres.length,
  );
}

describe("the stats grid takes any number of cards, the last row centred, and no card is styled by its place (T-WEB-S925)", () => {
  const hub = stylesheet("app/page.module.css");
  const stats = stylesheet("app/estatisticas/page.module.css");
  const statsMobile = bodyOf(stats, "@media (max-width: 768px)");

  it("never styles a card by its absolute place", () => {
    for (const css of [hub, stats]) {
      expect(css).not.toMatch(/(card|gameCard):nth-child\(\d+\)/i);
    }
  });

  it("rotates every stats card and its tape on a six-step cycle", () => {
    for (const step of CYCLE) {
      const selector = `.gameCard:nth-child(6n + ${String(step)})`;
      expect(decl(bodyOf(stats, selector), "transform"), selector).toMatch(
        ROTATION,
      );
      expect(
        decl(bodyOf(stats, `${selector} .tape`), "transform"),
        selector,
      ).toMatch(TAPE);
    }
  });

  it("tilts every hub card and its tape on a six-step cycle, read once by each", () => {
    for (const step of CYCLE) {
      const body = bodyOf(hub, `.card:nth-child(6n + ${String(step)})`);
      expect(decl(body, "--tilt"), String(step)).toMatch(ANGLE);
      expect(decl(body, "--tape-tilt"), String(step)).toMatch(/^-?[3-5]deg$/);
    }
    expect(decl(bodyOf(hub, ".card"), "transform")).toBe("rotate(var(--tilt))");
    expect(decl(bodyOf(hub, ".tape"), "transform")).toBe(
      "translateX(-50%) rotate(var(--tape-tilt))",
    );
  });

  it("lays the stats cards two to a row on four tracks, a lone last card centred, one column on a phone", () => {
    expect(trackCount(stats)).toBe(4);
    expect(decl(bodyOf(stats, ".gameCard"), "grid-column")).toBe("span 2");
    const lone = columnStart(
      decl(bodyOf(stats, ".gameCard:last-child:nth-child(odd)"), "grid-column"),
    );
    for (let count = 1; count <= 13; count += 1) {
      const centres = rowCentres(count, 4, (index, total) =>
        index === total && index % 2 === 1 ? lone : undefined,
      );
      expect(centres, `${String(count)} cards`).toEqual(centres.map(() => 2.5));
    }

    expect(decl(bodyOf(statsMobile, ".games"), "grid-template-columns")).toBe(
      "1fr",
    );
    expect(
      decl(
        bodyOf(
          statsMobile,
          ".gameCard,\n  .gameCard:last-child:nth-child(odd)",
        ),
        "grid-column",
      ),
    ).toBe("auto");
  });
});
