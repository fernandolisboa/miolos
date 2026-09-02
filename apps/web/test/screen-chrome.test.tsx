import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  dailyNonogramResponseSchema,
  dailySudokuResponseSchema,
  type DailyBinairoResponse,
  type DailyNonogramResponse,
  type DailySudokuResponse,
} from "@miolos/core";
import { generateBinairo } from "@miolos/games/binairo";
import { generateNonogram } from "@miolos/games/nonogram";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  PlaySkeleton as BinairoSkeleton,
  PlayView as BinairoView,
} from "../src/binairo/play-view";
import { initPlayState } from "../src/binairo/state";
import { BinairoFreeScreen } from "../src/free-play/binairo-free-screen";
import { NonogramFreeScreen } from "../src/free-play/nonogram-free-screen";
import { SudokuFreeScreen } from "../src/free-play/sudoku-free-screen";
import { formatElapsed, messages } from "../src/i18n";
import {
  PlaySkeleton as NonogramSkeleton,
  PlayView as NonogramView,
} from "../src/nonogram/play-view";
import { initNonogramPlayState } from "../src/nonogram/state";
import {
  DAILY_PLAY_BACK,
  PlayScreenChrome,
  type PlayChromeClock,
  type PlayChromeLive,
  type PlayChromeNote,
  type PlayChromeStat,
} from "../src/play/screen-chrome";
import screen from "../src/play/screen.module.css";
import {
  PlaySkeleton as SudokuSkeleton,
  PlayView as SudokuView,
} from "../src/sudoku/play-view";
import { initSudokuPlayState } from "../src/sudoku/state";
import { closureOf } from "./module-graph";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

const DATE = "2026-08-18";
const SEED = 20_260_818;
const WEEKDAY = 2;
const BLANK = "\u00a0";
const ELAPSED = 65_000;

function cls(local: string): string {
  const generated = screen[local];
  if (generated === undefined) {
    throw new Error(`play/screen.module.css declares no .${local}`);
  }
  return generated;
}

const BINAIRO = generateBinairo({ seed: SEED, weekday: WEEKDAY });
const BINAIRO_DAILY: DailyBinairoResponse = {
  game: "binairo",
  date: DATE,
  size: 8,
  givens: [...BINAIRO.givens],
};

const SUDOKU = generateDailySudoku({ seed: SEED, weekday: WEEKDAY });
const SUDOKU_DAILY: DailySudokuResponse = dailySudokuResponseSchema.parse({
  game: "sudoku",
  date: DATE,
  givens: SUDOKU.givens,
  tier: SUDOKU.tier,
});

const NONOGRAM = generateNonogram(SEED, WEEKDAY);
const NONOGRAM_DAILY: DailyNonogramResponse = dailyNonogramResponseSchema.parse(
  { game: "nonogram", date: DATE, size: NONOGRAM.size, clues: NONOGRAM.clues },
);

const noop = () => undefined;

const BINAIRO_PLAY = {
  state: initPlayState(BINAIRO_DAILY),
  elapsed: ELAPSED,
  filled: 12,
  hintReady: true,
  hintKind: "fill" as const,
  tapCell: noop,
  paintOver: noop,
  toggleMode: noop,
  revealHint: noop,
  pause: noop,
};

const SUDOKU_PLAY = {
  state: initSudokuPlayState(SUDOKU_DAILY),
  elapsed: ELAPSED,
  filled: 12,
  hintReady: false,
  hintKind: "correction" as const,
  selectCell: noop,
  moveSelection: noop,
  enterDigit: noop,
  clearCell: noop,
  revealHint: noop,
  pause: noop,
};

const NONOGRAM_PLAY = {
  state: initNonogramPlayState(NONOGRAM_DAILY),
  elapsed: ELAPSED,
  filled: 12,
  target: 40,
  hintReady: true,
  hintKind: null,
  selectCell: noop,
  moveSelection: noop,
  setBrush: noop,
  markCell: noop,
  enterValue: noop,
  clearCell: noop,
  paintOver: noop,
  revealHint: noop,
  pause: noop,
};

function pageIn(root: ParentNode): Element {
  const page = root.querySelector(`.${cls("page")}`);
  if (page === null) {
    throw new Error("no .page in the rendered tree");
  }
  return page;
}

function staticPage(element: ReactElement): Element {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(element);
  return pageIn(host);
}

function mountedPage(element: ReactElement): Element {
  return pageIn(render(element).container);
}

const GRID_AREAS = ["topBar", "titleBlock", "statsCard", "board", "hint"];

function areasOf(page: Element): readonly string[] {
  return [...page.children].map(
    (child) =>
      GRID_AREAS.find((area) => child.classList.contains(cls(area))) ??
      `unplaced:${child.className}`,
  );
}

describe("`.page` places the same five children, in DOM order, everywhere (T-WEB-S366)", () => {
  it("holds for the nine shipped composition shapes", () => {
    const observed = {
      "binairo daily": areasOf(staticPage(<BinairoView play={BINAIRO_PLAY} />)),
      "sudoku daily": areasOf(staticPage(<SudokuView play={SUDOKU_PLAY} />)),
      "nonogram daily": areasOf(
        staticPage(<NonogramView play={NONOGRAM_PLAY} />),
      ),
      "binairo skeleton": areasOf(staticPage(<BinairoSkeleton date={DATE} />)),
      "sudoku skeleton": areasOf(
        staticPage(<SudokuSkeleton date={DATE} tier={SUDOKU.tier} />),
      ),
      "nonogram skeleton": areasOf(
        staticPage(
          <NonogramSkeleton
            date={DATE}
            size={NONOGRAM_DAILY.size}
            clues={NONOGRAM_DAILY.clues}
          />,
        ),
      ),
      "free play playing": areasOf(
        mountedPage(<BinairoFreeScreen deps={{ pickSeed: () => SEED }} />),
      ),
      "free play generating": areasOf(
        staticPage(<SudokuFreeScreen deps={{ pickSeed: () => SEED }} />),
      ),
      "free play error": areasOf(
        mountedPage(
          <NonogramFreeScreen
            deps={{
              pickSeed: () => {
                throw new Error("no seed");
              },
            }}
          />,
        ),
      ),
    };

    expect(observed).toEqual(
      Object.fromEntries(
        Object.keys(observed).map((shape) => [shape, GRID_AREAS]),
      ),
    );
  });
});

const NOTE: PlayChromeNote = {
  text: "nota do arquivo",
  className: "note-mark",
};
const EXTRA: PlayChromeStat = {
  label: "Nível",
  value: "Médio",
  className: "extra-mark",
};
const PROGRESS_SHORT = "12/64";
const PROGRESS_LONG = "12 de 64 células";

function live(
  ready: boolean,
  explain: string | null,
  onReveal: () => void = noop,
): PlayChromeLive {
  return {
    progressShort: PROGRESS_SHORT,
    progressLong: PROGRESS_LONG,
    hint: { ready, label: "Dica", explain, onReveal },
  };
}

function chrome(variant: {
  readonly playState: "playing" | "skeleton" | "generating" | "error";
  readonly clock: PlayChromeClock;
  readonly extraStat: PlayChromeStat | null;
  readonly note: PlayChromeNote | null;
  readonly live: PlayChromeLive | null;
}): ReactElement {
  return (
    <PlayScreenChrome
      game="binairo"
      pageClassName="page-binairo"
      playState={variant.playState}
      back={DAILY_PLAY_BACK}
      topDate="18 de agosto"
      kicker="binário"
      title="Binairo"
      rules="as regras"
      note={variant.note}
      clock={variant.clock}
      extraStat={variant.extraStat}
      live={variant.live}
    >
      <div className={screen.gridCard} />
    </PlayScreenChrome>
  );
}

const DAILY_LIVE = {
  playState: "playing",
  clock: { elapsedMs: ELAPSED },
  extraStat: EXTRA,
  note: NOTE,
  live: live(true, null),
} as const;

const DAILY_SKELETON = {
  playState: "skeleton",
  clock: "blank",
  extraStat: null,
  note: null,
  live: null,
} as const;

const FREE_PLAYING = {
  playState: "playing",
  clock: "none",
  extraStat: EXTRA,
  note: null,
  live: live(false, "porque sim"),
} as const;

const FREE_GENERATING = {
  playState: "generating",
  clock: "none",
  extraStat: EXTRA,
  note: null,
  live: null,
} as const;

function textOf(page: Element, local: string): string {
  return page.querySelector(`.${cls(local)}`)?.textContent ?? "absent";
}

function hiddenOn(page: Element, local: string): string | null {
  const node = page.querySelector(`.${cls(local)}`);
  return node === null ? "absent" : node.getAttribute("aria-hidden");
}

function shapeOf(page: Element): Record<string, unknown> {
  const hint = page.querySelector(`.${cls("hint")}`);
  return {
    timerBar: textOf(page, "timerBar"),
    timerCard: textOf(page, "timerCard"),
    timers: page.querySelectorAll("[role='timer']").length,
    progressBar: textOf(page, "progressBar"),
    progressCard: textOf(page, "progressCard"),
    statRows: [...page.querySelectorAll(`.${cls("statRow")}`)].map((row) =>
      [...row.children].map((cell) => cell.textContent ?? ""),
    ),
    hint: hint === null ? "absent" : hint.tagName,
    hintDisabled: hint?.getAttribute("aria-disabled") ?? null,
    hintExplain: textOf(page, "hintExplain"),
    note: page.querySelector(".note-mark")?.textContent ?? "absent",
    extraStat: page.querySelector(".extra-mark")?.textContent ?? "absent",
    hidden: {
      statsCard: hiddenOn(page, "statsCard"),
      tape: hiddenOn(page, "tape"),
      progressCard: hiddenOn(page, "progressCard"),
      timerBar: hiddenOn(page, "timerBar"),
      progressBar: hiddenOn(page, "progressBar"),
    },
  };
}

describe("each chrome variant renders the markup its shape shipped (T-WEB-S367)", () => {
  it("renders the clock, the readouts, the extra stat, the note and the hint", () => {
    let revealed = 0;
    const clickable = mountedPage(
      chrome({
        ...FREE_PLAYING,
        live: live(true, null, () => {
          revealed += 1;
        }),
      }),
    );
    const button = clickable.querySelector(`.${cls("hint")}`);
    if (button === null) {
      throw new Error("the live chrome rendered no hint control");
    }
    fireEvent.click(button);

    const elapsed = formatElapsed(ELAPSED);
    expect({
      dailyLive: shapeOf(staticPage(chrome(DAILY_LIVE))),
      dailySkeleton: shapeOf(staticPage(chrome(DAILY_SKELETON))),
      freePlaying: shapeOf(staticPage(chrome(FREE_PLAYING))),
      freeGenerating: shapeOf(staticPage(chrome(FREE_GENERATING))),
      revealed,
    }).toEqual({
      dailyLive: {
        timerBar: elapsed,
        timerCard: elapsed,
        timers: 2,
        progressBar: PROGRESS_SHORT,
        progressCard: PROGRESS_LONG,
        statRows: [
          [messages.play.timerLabel, elapsed],
          [messages.play.progressLabel, PROGRESS_LONG],
          [EXTRA.label, EXTRA.value],
        ],
        hint: "BUTTON",
        hintDisabled: "false",
        hintExplain: "absent",
        note: NOTE.text,
        extraStat: EXTRA.value,
        hidden: {
          statsCard: null,
          tape: "true",
          progressCard: null,
          timerBar: null,
          progressBar: null,
        },
      },
      dailySkeleton: {
        timerBar: BLANK,
        timerCard: BLANK,
        timers: 0,
        progressBar: BLANK,
        progressCard: BLANK,
        statRows: [
          [messages.play.timerLabel, BLANK],
          [messages.play.progressLabel, BLANK],
        ],
        hint: "DIV",
        hintDisabled: null,
        hintExplain: "absent",
        note: "absent",
        extraStat: "absent",
        hidden: {
          statsCard: "true",
          tape: null,
          progressCard: null,
          timerBar: "true",
          progressBar: "true",
        },
      },
      freePlaying: {
        timerBar: "absent",
        timerCard: "absent",
        timers: 0,
        progressBar: PROGRESS_SHORT,
        progressCard: PROGRESS_LONG,
        statRows: [
          [messages.play.progressLabel, PROGRESS_LONG],
          [EXTRA.label, EXTRA.value],
        ],
        hint: "BUTTON",
        hintDisabled: "true",
        hintExplain: "porque sim",
        note: "absent",
        extraStat: EXTRA.value,
        hidden: {
          statsCard: null,
          tape: "true",
          progressCard: null,
          timerBar: "absent",
          progressBar: null,
        },
      },
      freeGenerating: {
        timerBar: "absent",
        timerCard: "absent",
        timers: 0,
        progressBar: BLANK,
        progressCard: BLANK,
        statRows: [
          [messages.play.progressLabel, BLANK],
          [EXTRA.label, EXTRA.value],
        ],
        hint: "DIV",
        hintDisabled: null,
        hintExplain: "absent",
        note: "absent",
        extraStat: EXTRA.value,
        hidden: {
          statsCard: null,
          tape: "true",
          progressCard: "true",
          timerBar: "absent",
          progressBar: "true",
        },
      },
      revealed: 1,
    });
  });
});

const CHROME = "apps/web/src/play/screen-chrome.tsx";

const WALLED = [
  "apps/web/src/play/sync.ts",
  "apps/web/src/play/play-record.ts",
  "apps/web/src/play/use-play-lifecycle.ts",
  "apps/web/src/play/day-state.ts",
  "apps/web/src/play/use-record-snapshot.ts",
  "apps/web/src/play/conclusion-view.tsx",
  "apps/web/src/play/conclusion-lazy.tsx",
  "apps/web/src/play/share-text.ts",
  "apps/web/src/play/share-button.tsx",
  "apps/web/src/play/daily-route.tsx",
  "apps/web/src/termo/guess-client.ts",
  "apps/web/src/session/bootstrap.ts",
  "apps/web/src/binairo/use-binairo-play.ts",
  "apps/web/src/sudoku/use-sudoku-play.ts",
  "apps/web/src/nonogram/use-nonogram-play.ts",
  "apps/web/src/binairo/binairo-screen.tsx",
  "apps/web/src/sudoku/sudoku-screen.tsx",
  "apps/web/src/nonogram/nonogram-screen.tsx",
];

describe("the chrome reaches nothing free play is walled from (T-WEB-S368)", () => {
  it("carries no banned module, and does carry the timer readout", () => {
    const closure = closureOf(CHROME);

    expect({
      reached: WALLED.filter((module) => closure.has(module)),
      misnamed: WALLED.filter((module) => !existsSync(join(REPO_ROOT, module))),
      timerReadout: closure.has("apps/web/src/play/timer-readout.tsx"),
    }).toEqual({ reached: [], misnamed: [], timerReadout: true });
  });
});
