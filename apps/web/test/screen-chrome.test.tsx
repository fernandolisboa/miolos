import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  dailyNonogramResponseSchema,
  FREE_HINTS_PER_PUZZLE,
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
import { formatElapsed, formatLongDate, messages, routes } from "../src/i18n";
import {
  PlaySkeleton as NonogramSkeleton,
  PlayView as NonogramView,
} from "../src/nonogram/play-view";
import { initNonogramPlayState } from "../src/nonogram/state";
import { accentVars } from "../src/play/accent";
import { DailyPlayChrome } from "../src/play/daily-chrome";
import { FreeHintsContext } from "../src/play/free-hints";
import {
  PlayScreenChrome,
  type ChromeGame,
  type PlayChromeBack,
  type PlayChromeClock,
  type PlayChromeNote,
  type PlayChromeReadouts,
  type PlayChromeStat,
  type PlayChromeState,
} from "../src/play/screen-chrome";
import screen from "../src/play/screen.module.css";
import type { ArchivePlayChrome } from "../src/play/types";
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
  solution: null,
  elapsed: ELAPSED,
  filled: 12,
  hintReady: true,
  tapCell: noop,
  strokeStart: noop,
  paintOver: noop,
  toggleMode: noop,
  revealHint: noop,
  reset: noop,
};

const SUDOKU_PLAY = {
  state: initSudokuPlayState(SUDOKU_DAILY),
  solution: null,
  elapsed: ELAPSED,
  filled: 12,
  hintReady: false,
  selectCell: noop,
  moveSelection: noop,
  enterDigit: noop,
  clearCell: noop,
  lock: {
    enabled: false,
    locked: null,
    pressDigit: noop,
    pressErase: noop,
    tapCell: noop,
  },
  revealHint: noop,
  reset: noop,
};

const NONOGRAM_PLAY = {
  state: initNonogramPlayState(NONOGRAM_DAILY),
  elapsed: ELAPSED,
  filled: 12,
  target: 40,
  hintReady: true,
  selectCell: noop,
  moveSelection: noop,
  setBrush: noop,
  markCell: noop,
  strokeStart: noop,
  enterValue: noop,
  clearCell: noop,
  paintOver: noop,
  revealHint: noop,
  reset: noop,
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

const GRID_AREAS = [
  "topBar",
  "titleBlock",
  "statsCard",
  "board",
  "reset",
  "hint",
];

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

describe("`.page` places the same six children, in DOM order, everywhere (T-WEB-S366)", () => {
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
const BACK: PlayChromeBack = {
  href: "/volta",
  label: "Voltar",
  ariaLabel: "Voltar para a volta",
};

function readouts(
  ready: boolean,
  explain: string | null,
  onReveal: () => void = noop,
  used = 0,
  onReset: (() => void) | null = noop,
): PlayChromeReadouts {
  return {
    progressShort: PROGRESS_SHORT,
    progressLong: PROGRESS_LONG,
    hint: { ready, used, explain, onReveal },
    onReset,
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
      back={BACK}
      topDate="18 de agosto"
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

function resetSlotOf(page: Element): unknown {
  const slot = page.querySelector(`.${cls("reset")}`);
  return slot === null
    ? "absent"
    : {
        buttons: slot.querySelectorAll("button").length,
        hidden: slot.firstElementChild?.getAttribute("aria-hidden") ?? null,
        disabled:
          slot.querySelector("button")?.getAttribute("aria-disabled") ?? null,
      };
}

const RESET_BUTTON = { buttons: 3, hidden: null, disabled: "false" };
const RESET_IDLE = { buttons: 3, hidden: null, disabled: "true" };
const RESET_PLACEHOLDER = { buttons: 0, hidden: "true", disabled: null };

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
    reset: resetSlotOf(page),
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
        reset: RESET_BUTTON,
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
        reset: RESET_PLACEHOLDER,
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
        reset: RESET_BUTTON,
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
        reset: RESET_PLACEHOLDER,
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
        "reset",
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

  it("renders a disabled trigger when the readouts carry no onReset", () => {
    const page = staticPage(
      chrome({
        ...DAILY_LIVE,
        state: {
          kind: "playing",
          readouts: readouts(true, null, noop, 0, null),
        },
      }),
    );

    expect(resetSlotOf(page)).toEqual(RESET_IDLE);
  });
});

function hintOf(
  ready: boolean,
  used: number,
  allowance: number | null = FREE_HINTS_PER_PUZZLE,
): Element {
  const page = staticPage(
    <FreeHintsContext value={allowance}>
      {chrome({
        ...FREE_PLAYING,
        state: { kind: "playing", readouts: readouts(ready, null, noop, used) },
      })}
    </FreeHintsContext>,
  );
  const hint = page.querySelector(`.${cls("hint")}`);
  if (hint === null) {
    throw new Error("the live chrome rendered no hint control");
  }
  return hint;
}

describe("the hint button counts the free hints down from `used` (T-WEB-S512)", () => {
  it("reads the hints left, then that they are spent", () => {
    expect(
      [0, 1, 2, 3].map((used) => hintOf(used < 3, used).textContent),
    ).toEqual([
      "Usar dica — 3 disponíveis",
      "Usar dica — 2 disponíveis",
      "Usar dica — 1 disponível",
      "Dicas usadas",
    ]);
  });

  it("keeps the count on a board closed before any hint, disabled", () => {
    const hint = hintOf(false, 0);

    expect(hint.textContent).toBe("Usar dica — 3 disponíveis");
    expect(hint.getAttribute("aria-disabled")).toBe("true");
  });

  it("counts from the default while the allowance loads, and is not ready", () => {
    const hint = hintOf(false, 0, null);

    expect(hint.textContent).toBe("Usar dica — 3 disponíveis");
    expect(hint.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("the hint button counts down from the served allowance (T-WEB-S538)", () => {
  it("reads five hints left down to spent under an allowance of five", () => {
    expect(
      [0, 1, 2, 3, 4, 5].map((used) => hintOf(used < 5, used, 5).textContent),
    ).toEqual([
      "Usar dica — 5 disponíveis",
      "Usar dica — 4 disponíveis",
      "Usar dica — 3 disponíveis",
      "Usar dica — 2 disponíveis",
      "Usar dica — 1 disponível",
      "Dicas usadas",
    ]);
  });

  it("reads spent when a restored count is past a lowered allowance", () => {
    expect(hintOf(false, 3, 2).textContent).toBe("Dicas usadas");
  });
});

describe("the hint's reason is read out from one polite live region (T-WEB-S555)", () => {
  function liveRegions(root: ParentNode): readonly Element[] {
    return [...root.querySelectorAll(`.${cls("board")} [aria-live]`)];
  }

  it("mounts the region before any reason, and fills that same node", () => {
    const { container, rerender } = render(chrome(DAILY_LIVE));
    const [region, ...others] = liveRegions(container);

    expect(others).toEqual([]);
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(region?.getAttribute("role")).toBeNull();
    expect(region?.textContent).toBe("");

    rerender(chrome(FREE_PLAYING));

    expect(liveRegions(container)).toEqual([region]);
    expect(region?.querySelector(`.${cls("hintExplain")}`)?.textContent).toBe(
      "porque sim",
    );
  });

  it("mounts a new sentence for each hint, so the same words are read again", () => {
    const afterHints = (used: number) =>
      chrome({
        ...FREE_PLAYING,
        state: {
          kind: "playing",
          readouts: readouts(true, "porque sim", noop, used),
        },
      });
    const { container, rerender } = render(afterHints(1));
    const first = container.querySelector(`.${cls("hintExplain")}`);

    rerender(afterHints(2));
    const second = container.querySelector(`.${cls("hintExplain")}`);

    expect(second?.textContent).toBe("porque sim");
    expect(second).not.toBe(first);
    expect(first?.isConnected).toBe(false);
  });

  it("is there on the skeleton too, empty", () => {
    const regions = liveRegions(staticPage(chrome(DAILY_SKELETON)));

    expect(regions.map((region) => region.textContent)).toEqual([""]);
  });
});

describe("the chrome's back link is routed (T-WEB-S376)", () => {
  it("imports next/link", () => {
    expect(valueSpecifiersOf(CHROME)).toContain("next/link");
  });
});

describe("the chrome looks its copy up by game (T-WEB-S486)", () => {
  const GAMES: readonly ChromeGame[] = [
    "sudoku",
    "nonogram",
    "binairo",
    "crossword",
    "queens",
  ];

  function dailyChrome(
    game: ChromeGame,
    archive?: ArchivePlayChrome,
  ): ReactElement {
    return (
      <DailyPlayChrome
        game={game}
        pageModifier={PAGE_MODIFIER}
        date={DATE}
        archive={archive}
        clock="blank"
        extraStat={null}
        state={{ kind: "skeleton" }}
      >
        <div className={screen.gridCard} />
      </DailyPlayChrome>
    );
  }

  it("shows each game's kicker, title and rules", () => {
    for (const game of GAMES) {
      const page = staticPage(dailyChrome(game));
      const copy = messages.games[game];
      expect(
        {
          barKicker: textOf(page, "barKicker"),
          titleKicker: textOf(page, "titleKicker"),
          title: textOf(page, "title"),
          rules: textOf(page, "rules"),
        },
        game,
      ).toEqual({
        barKicker: copy.kicker,
        titleKicker: copy.kicker,
        title: copy.play.title,
        rules: copy.play.rules,
      });
    }
  });

  it("links home with the long date and no note on a daily", () => {
    const page = staticPage(dailyChrome("binairo"));
    const back = page.querySelector(`.${cls("back")}`);

    expect(back?.getAttribute("href")).toBe(routes.home);
    expect(back?.textContent).toBe(messages.play.back);
    expect(back?.getAttribute("aria-label")).toBe(messages.play.backAria);
    expect(textOf(page, "topDate")).toBe(formatLongDate(DATE));
    expect(page.querySelectorAll(`.${cls("titleBlock")} > p`)).toHaveLength(2);
  });

  it("links to the archive and carries its note when it is one", () => {
    const archive: ArchivePlayChrome = {
      back: { href: "/arquivo", label: "Arquivo", ariaLabel: "Voltar" },
      note: { text: "Jogo do arquivo", className: "archive-note" },
    };
    const page = staticPage(dailyChrome("binairo", archive));
    const back = page.querySelector(`.${cls("back")}`);

    expect(back?.getAttribute("href")).toBe("/arquivo");
    expect(back?.textContent).toBe("Arquivo");
    expect(page.querySelector(".archive-note")?.textContent).toBe(
      "Jogo do arquivo",
    );
    expect(page.querySelectorAll(`.${cls("titleBlock")} > p`)).toHaveLength(3);
  });
});

describe("the reset slot keeps its height from the skeleton to the board (T-WEB-S593)", () => {
  function slotOf(variant: Parameters<typeof chrome>[0]): Element {
    const slot = staticPage(chrome(variant)).querySelector(`.${cls("reset")}`);
    if (slot === null) {
      throw new Error("no reset slot");
    }
    return slot;
  }

  it("holds a child for each of the board's visible ones, the settings one included", () => {
    expect(slotOf(DAILY_SKELETON).children).toHaveLength(
      slotOf(DAILY_LIVE).querySelectorAll(":scope > :not(dialog)").length,
    );
  });

  it("is inert and hidden in the skeleton, with no control in it", () => {
    const slot = slotOf(DAILY_SKELETON);

    expect(slot.querySelector("button, a, input")).toBeNull();
    for (const child of slot.children) {
      expect(child).toHaveAttribute("aria-hidden", "true");
    }
  });
});
