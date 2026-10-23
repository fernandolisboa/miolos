import { normalizeWord } from "@miolos/games";
import {
  TERMO_VALIDATION_WORDS,
  type KeyboardState,
} from "@miolos/games/termo";
import { drawFreeTermoWords } from "@miolos/games/termo-free";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SplitKeyboard } from "../src/free-play/split-keyboard";
import { TermoFreeScreen } from "../src/free-play/termo-free-screen";
import variantStyles from "../src/free-play/termo-variants.module.css";
import {
  initTermoVariant,
  termoVariantReducer,
  type TermoVariantAction,
  type TermoVariantState,
} from "../src/free-play/use-termo-variant";
import { messages } from "../src/i18n";
import boardStyles from "../src/termo/termo-board.module.css";
import { bodyOf, decl, pixels, stylesheet } from "./css-source";
import { flushGeneration } from "./free-generation";
import { valueClosureOf } from "./module-graph";

const SEED = 20_261_015;
const WORDS = drawFreeTermoWords(SEED, 4);
const copy = messages.freePlay.variant;
const play = messages.games.termo.play;

async function variantsLanded(): Promise<void> {
  await act(async () => {
    await import("../src/free-play/termo-variants");
    await Promise.resolve();
    await Promise.resolve();
  });
}

function misses(answers: readonly string[], count: number): string[] {
  const taken = new Set(answers.map(normalizeWord));
  return TERMO_VALIDATION_WORDS.filter((word) => !taken.has(word)).slice(
    0,
    count,
  );
}

function typed(state: TermoVariantState, word: string): TermoVariantState {
  const actions: TermoVariantAction[] = [
    ...[...normalizeWord(word)].map((letter) => ({
      type: "type" as const,
      letter,
    })),
    { type: "submit" },
    { type: "judged" },
  ];
  return actions.reduce(termoVariantReducer, state);
}

async function guess(word: string): Promise<void> {
  for (const letter of normalizeWord(word)) {
    fireEvent.keyDown(document.body, { key: letter });
  }
  await act(async () => {
    fireEvent.keyDown(document.body, { key: "Enter" });
    await Promise.resolve();
  });
}

async function renderScreen() {
  const view = render(<TermoFreeScreen deps={{ pickSeed: () => SEED }} />);
  await flushGeneration();
  await variantsLanded();
  return view;
}

async function choose(name: string): Promise<void> {
  fireEvent.click(
    screen.getByRole("radio", { name: copy.aria(name), hidden: true }),
  );
  await flushGeneration();
}

function editableCells(): HTMLElement[] {
  return screen.queryAllByRole("button", { name: /^letra \d de 5/ });
}

const hidePopover = vi.fn();

beforeEach(() => {
  hidePopover.mockClear();
  HTMLElement.prototype.hidePopover = hidePopover;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the variant reducer judges every open board with one draft (T-WEB-S890)", () => {
  const [one = "", two = ""] = WORDS;
  const start = initTermoVariant([one, two], 7);

  it("closes a board on its word, keeps the other open and says so", () => {
    const state = typed(start, one);

    expect(state.guesses).toEqual([normalizeWord(one)]);
    expect(state.draft.join("")).toBe("");
    expect(state.notice).toBeNull();
    expect(state.announcement).toContain(copy.foundAria(1));
    expect(state.announcement).toContain(copy.boardAria(2, 2));
  });

  it("refuses a word outside the dictionary on the notice, not the announcer, and ignores a short draft", () => {
    const short = termoVariantReducer(
      termoVariantReducer(start, { type: "type", letter: "a" }),
      { type: "submit" },
    );
    expect(short.guesses).toEqual([]);
    expect(short.notice).toBeNull();

    const refused = typed(start, "zzzzz");
    expect(refused.guesses).toEqual([]);
    expect(refused.notice).toBe(play.notInList);
    expect(refused.noticeNonce).toBe(1);
    expect(refused.announcement).not.toBe(play.notInList);
  });

  it("never writes the notice and the announcer in one step, and judges a held word only on its own step", () => {
    const script: TermoVariantAction[] = [
      ...[..."zzzzz"].map((letter) => ({ type: "type" as const, letter })),
      { type: "submit" },
      ...Array.from({ length: 5 }, () => ({ type: "erase" as const })),
      ...[...normalizeWord(one)].map((letter) => ({
        type: "type" as const,
        letter,
      })),
      { type: "submit" },
      { type: "type", letter: "a" },
      { type: "judged" },
    ];
    let state = start;
    for (const action of script) {
      const next = termoVariantReducer(state, action);
      const wrote = [
        next.notice !== state.notice,
        next.announcement !== state.announcement,
      ].filter(Boolean);
      expect(wrote.length).toBeLessThanOrEqual(1);
      if (action.type === "submit" && next.pending !== null) {
        expect(next.guesses).toEqual(state.guesses);
      }
      state = next;
    }
    expect(state.pending).toBeNull();
    expect(state.guesses).toEqual([normalizeWord(one)]);
    expect(state.draft.join("")).toBe("");
  });

  it("wins when both words are found and then takes nothing more", () => {
    const won = typed(typed(start, two), one);
    expect(won.guesses).toHaveLength(2);
    expect(typed(won, two)).toBe(won);
  });

  it("loses after seven misses and then takes nothing more", () => {
    const lost = misses([one, two], 7).reduce(typed, start);
    expect(lost.guesses).toHaveLength(7);
    expect(termoVariantReducer(lost, { type: "type", letter: "a" })).toBe(lost);
  });
});

describe("the Variante menu deals Dueto and Quarteto boards (T-WEB-S891)", () => {
  // ADR-0055: CI gate 2543 ms (40 runs) × 4 → 15_000.
  it("starts on Clássico and deals two boards of seven, then four of nine, with distinct words", async () => {
    await renderScreen();

    expect(
      screen.getByRole("button", { name: copy.triggerAria(copy.classico) }),
    ).toHaveTextContent(copy.classico);
    expect(screen.getAllByRole("group", { name: play.boardAria })).toHaveLength(
      1,
    );

    await choose(copy.dueto);
    expect(
      screen.getByRole("button", { name: copy.triggerAria(copy.dueto) }),
    ).toBeInTheDocument();
    for (const board of [1, 2]) {
      const group = screen.getByRole("group", {
        name: copy.boardAria(board, 2),
      });
      expect(within(group).getAllByRole("group")).toHaveLength(7);
    }

    await choose(copy.quarteto);
    for (const board of [1, 2, 3, 4]) {
      const group = screen.getByRole("group", {
        name: copy.boardAria(board, 4),
      });
      expect(within(group).getAllByRole("group")).toHaveLength(9);
    }
    expect(screen.getByText(play.progressShort(0, 9))).toBeInTheDocument();
    expect(new Set(WORDS.map(normalizeWord)).size).toBe(4);
  }, 15_000);

  it("closes the menu when a variant is picked", async () => {
    await renderScreen();
    await choose(copy.dueto);

    expect(hidePopover).toHaveBeenCalled();
  });
});

describe("only the first open board edits, and focus follows it (T-WEB-S892)", () => {
  it("holds one editable row, mirrors the draft on the other board, and moves focus to board 2 when board 1 closes", async () => {
    await renderScreen();
    await choose(copy.dueto);
    const [one = ""] = WORDS;

    expect(editableCells()).toHaveLength(5);
    const second = screen.getByRole("group", { name: copy.boardAria(2, 2) });
    expect(within(second).queryAllByRole("button")).toHaveLength(0);

    fireEvent.keyDown(document.body, { key: "c" });
    expect(
      within(second).getByRole("group", { name: play.rowActiveAria(1, 7) }),
    ).toHaveTextContent("c");

    fireEvent.keyDown(document.body, { key: "Backspace" });
    editableCells()[0]?.focus();
    await guess(one);

    const cells = editableCells();
    expect(cells).toHaveLength(5);
    expect(second.contains(document.activeElement)).toBe(true);
  });
});

describe("the split key marks each open board (T-WEB-S893)", () => {
  const render4 = (states: readonly (KeyboardState | null)[]) =>
    render(
      <SplitKeyboard
        states={states}
        onLetter={vi.fn()}
        onEnter={vi.fn()}
        onErase={vi.fn()}
      />,
    );

  it("draws one segment per board and names each mark", () => {
    render4([{ a: "correct" }, { a: "absent" }, null, { a: "present" }]);
    const key = screen.getByRole("button", { name: /^letra a/ });

    expect(key).toHaveAccessibleName(
      "letra a: 1ª palavra, certa; 2ª palavra, fora; 4ª palavra, na palavra",
    );
    const segments = key.querySelector(`.${variantStyles.segments ?? ""}`);
    expect(
      [...(segments?.children ?? [])].map((segment) => segment.className),
    ).toEqual([
      variantStyles.segmentCorrect,
      variantStyles.segmentAbsent,
      "",
      variantStyles.segmentPresent,
    ]);
    expect(key).not.toHaveClass(boardStyles.keyAbsent ?? "");
  });

  it("strikes a letter only when every open board rules it out", () => {
    const open = render4([{ b: "absent" }, null, { b: "absent" }, {}]);

    expect(screen.getByRole("button", { name: /^letra b/ })).not.toHaveClass(
      boardStyles.keyAbsent ?? "",
    );
    open.unmount();

    render4([{ d: "absent" }, null]);
    const struck = screen.getByRole("button", { name: /^letra d/ });
    expect(struck).toHaveClass(boardStyles.keyAbsent ?? "");
    expect(struck.querySelector(`.${variantStyles.segments ?? ""}`)).toBeNull();
  });

  it("names the untouched letters and the two commands as the classic keyboard does", () => {
    render4([{}, {}]);

    expect(
      screen.getByRole("button", { name: play.keyboard.letterAria("q") }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: play.keyboard.enterAria }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: play.keyboard.eraseAria }),
    ).toBeInTheDocument();
  });
});

describe("Dueto ends on the free-play card with every word (T-WEB-S894)", () => {
  it("wins to a card naming the variant, both words and both boards, with no I/O", async () => {
    const fetchMock = vi.fn(() => {
      throw new Error("free play must not fetch");
    });
    vi.stubGlobal("fetch", fetchMock);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { container } = await renderScreen();
    await choose(copy.dueto);
    const [one = "", two = ""] = WORDS;

    await guess(two);
    await guess(one);

    expect(container.querySelector("main")).toHaveAttribute(
      "data-play-state",
      "solved",
    );
    expect(screen.getByText("Modo livre · Termo · Dueto")).toBeVisible();
    expect(
      screen.getByText(messages.freePlay.solved.wordsLead),
    ).toBeInTheDocument();
    expect(screen.getByText(one)).toBeInTheDocument();
    expect(screen.getByText(two)).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: copy.boardAria(2, 2) }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  // ADR-0055: CI gate 2322 ms (40 runs) × 4 → 10_000.
  it("loses after seven misses to a card that shows the words", async () => {
    const { container } = await renderScreen();
    await choose(copy.dueto);

    for (const word of misses(WORDS.slice(0, 2), 7)) {
      await guess(word);
    }

    expect(container.querySelector("main")).toHaveAttribute(
      "data-play-state",
      "lost",
    );
    expect(screen.getByText(messages.freePlay.solved.lostStamp)).toBeVisible();
    expect(screen.getByText(WORDS[1] ?? "")).toBeInTheDocument();
  }, 10_000);
});

describe("the variant chunk never reaches the free pool (T-WEB-S895)", () => {
  it("gets its words as props", () => {
    expect(
      [...valueClosureOf("apps/web/src/free-play/termo-variants.tsx")].filter(
        (module) => /termo-free|termo-answers/.test(module),
      ),
    ).toEqual([]);
  });
});

describe("the variant layout, as stylesheet text (T-WEB-S896)", () => {
  const css = stylesheet("src/free-play/termo-variants.module.css");
  const phone = bodyOf(css, "@media (max-width: 768px)");
  const quartetoPhone = bodyOf(phone, ".page.quarteto");

  it("sizes a tile from one board's width through --boards-across", () => {
    const termo = stylesheet("src/termo/termo-board.module.css");
    expect(decl(bodyOf(termo, ".tile"), "font-size")).toMatch(
      /calc\(var\(--board-side\) \* 0\.105 \/ var\(--boards-across, 1\)\)/,
    );
    expect(decl(bodyOf(css, ".page.quarteto"), "--boards-across")).toBe("4");
    expect(
      decl(
        bodyOf(bodyOf(css, "@media (max-width: 1119px)"), ".page.quarteto"),
        "--boards-across",
      ),
    ).toBe("2");
  });

  it("drops the title, tightens the notice and the tile gap for Quarteto on a phone, through hooks the shared sheets default", () => {
    expect(decl(quartetoPhone, "--title-display")).toBe("none");
    expect(decl(quartetoPhone, "--notice-min")).toBe("28px");
    expect(decl(quartetoPhone, "--keyboard-gap")).toBe("0px");
    expect(decl(quartetoPhone, "--tile-gap")).toBe("2px");
    expect(
      decl(
        bodyOf(stylesheet("src/play/screen.module.css"), ".titleBlock"),
        "display",
      ),
    ).toBe("var(--title-display, block)");
  });

  it("keeps every variant tile at or above 24px when the well sits at its floor", () => {
    const widthAt24 = (
      across: number,
      pad: number,
      columnGap: number,
      tileGap: number,
    ) =>
      across * (5 * 24 + 4 * tileGap) + (across - 1) * columnGap + 2 * pad + 2;
    const floorWidth = (body: string) =>
      pixels(decl(body, "--board-min")) * Number(decl(body, "--board-aspect"));
    const tablet = bodyOf(
      bodyOf(css, "@media (max-width: 1119px)"),
      ".page.quarteto",
    );

    expect(decl(phone, "--grid-card-pad")).toBe("6px");
    expect(decl(bodyOf(phone, ".boards"), "gap")).toBe("6px 10px");
    expect(decl(bodyOf(css, ".boards"), "gap")).toBe(
      "var(--space-4) var(--space-5)",
    );
    expect(
      pixels(decl(quartetoPhone, "--board-min")) *
        Number(decl(tablet, "--board-aspect")),
    ).toBeGreaterThanOrEqual(widthAt24(2, 6, 10, 2));
    expect(floorWidth(tablet)).toBeGreaterThanOrEqual(widthAt24(2, 16, 20, 4));
    expect(floorWidth(bodyOf(css, ".page.dueto"))).toBeGreaterThanOrEqual(
      widthAt24(2, 16, 20, 4),
    );
    expect(floorWidth(bodyOf(css, ".page.quarteto"))).toBeGreaterThanOrEqual(
      widthAt24(4, 16, 20, 4),
    );
    expect(320 - 2 * 16).toBeGreaterThanOrEqual(widthAt24(2, 6, 10, 2));
  });
});

describe("physical keys drive the variant board (T-WEB-S897)", () => {
  it("types, erases and submits from the page", async () => {
    await renderScreen();
    await choose(copy.quarteto);

    for (const key of ["c", "a", "x", "Backspace"]) {
      fireEvent.keyDown(document.body, { key });
    }
    const first = screen.getByRole("group", { name: copy.boardAria(1, 4) });
    expect(
      within(first).getByRole("group", { name: play.rowActiveAria(1, 9) }),
    ).toHaveTextContent("ca");

    await guess("rta");
    expect(screen.getByText(play.progressShort(1, 9))).toBeInTheDocument();
  });
});
