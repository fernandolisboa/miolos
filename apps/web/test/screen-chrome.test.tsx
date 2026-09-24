import { readFileSync } from "node:fs";
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
import { accentVars } from "../src/play/accent";
import {
  DAILY_PLAY_BACK,
  PlayScreenChrome,
  type PlayChromeClock,
  type PlayChromeNote,
  type PlayChromeReadouts,
  type PlayChromeStat,
  type PlayChromeState,
} from "../src/play/screen-chrome";
import screen from "../src/play/screen.module.css";
import {
  PlaySkeleton as SudokuSkeleton,
  PlayView as SudokuView,
} from "../src/sudoku/play-view";
import { initSudokuPlayState } from "../src/sudoku/state";
import { stylesheet } from "./css-source";
import { valueSpecifiersOf } from "./module-graph";
import { withoutComments } from "./ts-source";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");
const CHROME = "apps/web/src/play/screen-chrome.tsx";

function sourceOf(module: string): string {
  return withoutComments(readFileSync(join(REPO_ROOT, module), "utf8"));
}
const SHARED_CSS = stylesheet("src/play/screen.module.css");

const DATE = "2026-08-18";
const SEED = 20_260_818;
const WEEKDAY = 2;
const BLANK = "\u00a0";
const ELAPSED = 65_000;

function cls(local: string): string {
  if (!new RegExp(`(?:^|[\\s,])\\.${local}(?![\\w-])`, "m").test(SHARED_CSS)) {
    throw new Error(`play/screen.module.css declares no .${local}`);
  }
  const generated = screen[local];
  if (generated === undefined) {
    throw new Error(`the CSS module exposes no key for .${local}`);
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

function placementOf(page: Element): Record<string, unknown> {
  return {
    areas: [...page.children].map(
      (child) =>
        GRID_AREAS.find((area) => child.classList.contains(cls(area))) ??
        `unplaced:${child.className}`,
    ),
    state: page.getAttribute("data-play-state"),
  };
}

function placed(state: string): Record<string, unknown> {
  return { areas: GRID_AREAS, state };
}

describe("`.page` places the same five children, in DOM order, everywhere (T-WEB-S366)", () => {
  it("holds for the nine shipped composition shapes", () => {
    expect({
      "binairo daily": placementOf(
        staticPage(<BinairoView play={BINAIRO_PLAY} />),
      ),
      "sudoku daily": placementOf(
        staticPage(<SudokuView play={SUDOKU_PLAY} />),
      ),
      "nonogram daily": placementOf(
        staticPage(<NonogramView play={NONOGRAM_PLAY} />),
      ),
      "binairo skeleton": placementOf(
        staticPage(<BinairoSkeleton date={DATE} />),
      ),
      "sudoku skeleton": placementOf(
        staticPage(<SudokuSkeleton date={DATE} tier={SUDOKU.tier} />),
      ),
      "nonogram skeleton": placementOf(
        staticPage(
          <NonogramSkeleton
            date={DATE}
            size={NONOGRAM_DAILY.size}
            clues={NONOGRAM_DAILY.clues}
          />,
        ),
      ),
      "free play playing": placementOf(
        mountedPage(<BinairoFreeScreen deps={{ pickSeed: () => SEED }} />),
      ),
      "free play generating": placementOf(
        staticPage(<SudokuFreeScreen deps={{ pickSeed: () => SEED }} />),
      ),
      "free play error": placementOf(
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
    }).toEqual({
      "binairo daily": placed("playing"),
      "sudoku daily": placed("playing"),
      "nonogram daily": placed("playing"),
      "binairo skeleton": placed("skeleton"),
      "sudoku skeleton": placed("skeleton"),
      "nonogram skeleton": placed("skeleton"),
      "free play playing": placed("playing"),
      "free play generating": placed("generating"),
      "free play error": placed("error"),
    });
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
const PAGE_MODIFIER = "page-binairo";

function readouts(
  ready: boolean,
  explain: string | null,
  onReveal: () => void = noop,
): PlayChromeReadouts {
  return {
    progressShort: PROGRESS_SHORT,
    progressLong: PROGRESS_LONG,
    hint: { ready, label: "Dica", explain, onReveal },
  };
}

function chrome(variant: {
  readonly state: PlayChromeState;
  readonly clock: PlayChromeClock;
  readonly extraStat: PlayChromeStat | null;
  readonly note: PlayChromeNote | null;
}): ReactElement {
  return (
    <PlayScreenChrome
      game="binairo"
      pageModifier={PAGE_MODIFIER}
      state={variant.state}
      back={DAILY_PLAY_BACK}
      topDate="18 de agosto"
      kicker="binário"
      title="Binairo"
      rules="as regras"
      note={variant.note}
      clock={variant.clock}
      extraStat={variant.extraStat}
    >
      <div className={screen.gridCard} />
    </PlayScreenChrome>
  );
}

const DAILY_LIVE = {
  state: { kind: "playing", readouts: readouts(true, null) },
  clock: { elapsedMs: ELAPSED },
  extraStat: EXTRA,
  note: NOTE,
} as const;

const DAILY_SKELETON = {
  state: { kind: "skeleton" },
  clock: "blank",
  extraStat: null,
  note: null,
} as const;

const FREE_PLAYING = {
  state: { kind: "playing", readouts: readouts(false, "porque sim") },
  clock: "none",
  extraStat: EXTRA,
  note: null,
} as const;

const FREE_GENERATING = {
  state: { kind: "generating" },
  clock: "none",
  extraStat: EXTRA,
  note: null,
} as const;

function textOf(page: Element, local: string): string {
  return page.querySelector(`.${cls(local)}`)?.textContent ?? "absent";
}

function hiddenOn(page: Element, local: string): string | null {
  const node = page.querySelector(`.${cls(local)}`);
  return node === null ? "absent" : node.getAttribute("aria-hidden");
}

const CHROME_CLASSES = [
  ...new Set(
    [
      ...sourceOf(CHROME)
        .replace(/^import .*$/gm, "")
        .matchAll(/\bscreen\.([A-Za-z0-9_]+)/g),
    ].map((match) => match[1] ?? ""),
  ),
].sort();

const LOCAL_NAME_OF = new Map(
  CHROME_CLASSES.map((local) => [cls(local), local]),
);

function localNamesOf(node: Element): readonly string[] {
  return [...node.classList].map((name) => LOCAL_NAME_OF.get(name) ?? name);
}

function shapeOf(page: Element): Record<string, unknown> {
  const hint = page.querySelector(`.${cls("hint")}`);
  return {
    pageClasses: localNamesOf(page),
    accent: page.getAttribute("style"),
    timerBar: textOf(page, "timerBar"),
    timerCard: textOf(page, "timerCard"),
    timers: page.querySelectorAll("[role='timer']").length,
    progressBar: textOf(page, "progressBar"),
    progressCard: textOf(page, "progressCard"),
    statRows: [...page.querySelectorAll(`.${cls("statRow")}`)].map((row) =>
      [...row.children].map((cell) => cell.textContent ?? ""),
    ),
    hint: hint === null ? "absent" : hint.tagName,
    hintClasses: hint === null ? "absent" : localNamesOf(hint),
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

const ACCENT_STYLE = Object.entries(accentVars("binairo"))
  .map(([name, value]) => `${name}:${String(value)}`)
  .join(";");

const PAGE_CLASSES = ["page", PAGE_MODIFIER];

describe("each chrome variant renders the markup its shape shipped (T-WEB-S367)", () => {
  it("renders the page classes, accent, clock, readouts, stats, note and hint", () => {
    let revealed = 0;
    const clickable = mountedPage(
      chrome({
        ...FREE_PLAYING,
        state: {
          kind: "playing",
          readouts: readouts(true, null, () => {
            revealed += 1;
          }),
        },
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
      chromeClasses: CHROME_CLASSES,
    }).toEqual({
      dailyLive: {
        pageClasses: PAGE_CLASSES,
        accent: ACCENT_STYLE,
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
        hintClasses: ["hint"],
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
        pageClasses: PAGE_CLASSES,
        accent: ACCENT_STYLE,
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
        hintClasses: ["hint", "hintUsed", "placeholder"],
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
        pageClasses: PAGE_CLASSES,
        accent: ACCENT_STYLE,
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
        hintClasses: ["hint", "hintUsed"],
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
        pageClasses: PAGE_CLASSES,
        accent: ACCENT_STYLE,
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
        hintClasses: ["hint", "hintUsed", "placeholder"],
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
      chromeClasses: [
        "back",
        "barKicker",
        "board",
        "hint",
        "hintExplain",
        "hintUsed",
        "page",
        "placeholder",
        "progressBar",
        "progressCard",
        "rules",
        "statLabel",
        "statRow",
        "statsCard",
        "tape",
        "timerBar",
        "timerCard",
        "title",
        "titleBlock",
        "titleKicker",
        "titleRow",
        "topBar",
        "topDate",
        "wordmark",
      ],
    });
  });
});

describe("the chrome's back link is routed (T-WEB-S371)", () => {
  it("imports next/link", () => {
    expect(valueSpecifiersOf(CHROME)).toContain("next/link");
  });
});
