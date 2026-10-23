import { normalizeWord } from "@miolos/games";
import {
  evaluateGuess,
  isValidGuess,
  MAX_GUESSES,
  TERMO_VALIDATION_WORDS,
  TERMO_VARIANTS,
} from "@miolos/games/termo";
import { drawFreeTermoWords } from "@miolos/games/termo-free";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FREE_PLAY_DATE } from "../src/free-play/catalog";
import { TermoFreeScreen } from "../src/free-play/termo-free-screen";
import {
  judgeFreeGuess,
  useFreeTermoBoard,
} from "../src/free-play/use-free-termo";
import { useTermoVariant } from "../src/free-play/use-termo-variant";
import { formatLongDate, messages, routes } from "../src/i18n";
import { PlaySkeleton, PlayView } from "../src/termo/play-view";
import { initTermoPlayState } from "../src/termo/state";
import type { TermoJudgedRow } from "../src/termo/types";
import { flushGeneration } from "./free-generation";

const SEED = 20_261_015;
const NEXT_SEED = 20_261_016;
const WORD = drawFreeTermoWords(SEED, 1)[0] ?? "";
const NEXT_WORD = drawFreeTermoWords(NEXT_SEED, 1)[0] ?? "";
const ACCENTED = "ábaco";
const PROFANITY = "merda";
const START = initTermoPlayState(FREE_PLAY_DATE);

function misses(answer: string): readonly string[] {
  return TERMO_VALIDATION_WORDS.filter(
    (word) => word !== normalizeWord(answer),
  ).slice(0, MAX_GUESSES);
}

function rows(words: readonly string[], answer: string): TermoJudgedRow[] {
  return words.map((guess) => ({ guess, tiles: evaluateGuess(guess, answer) }));
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

function stubNoIo() {
  const fetchMock = vi.fn(() => {
    throw new Error("free play must not fetch");
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, setItem: vi.spyOn(Storage.prototype, "setItem") };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("judgeFreeGuess judges on the device and reveals the word only at the end (T-WEB-S700)", () => {
  it("returns tiles and keeps the answer back while the board is open", () => {
    const [first = ""] = misses(ACCENTED);

    expect(judgeFreeGuess(START, first, ACCENTED)).toEqual({
      type: "judged",
      guess: first,
      tiles: evaluateGuess(first, ACCENTED),
      status: "playing",
      answer: undefined,
    });
  });

  it("wins on the unaccented spelling and reveals the accented one", () => {
    expect(judgeFreeGuess(START, "abaco", ACCENTED)).toMatchObject({
      status: "won",
      tiles: ["correct", "correct", "correct", "correct", "correct"],
      answer: ACCENTED,
    });
  });

  it("loses on the sixth miss and reveals the word", () => {
    const words = misses(ACCENTED);
    const last = words.at(-1) ?? "";
    const armed = { ...START, guesses: rows(words.slice(0, -1), ACCENTED) };

    expect(judgeFreeGuess(armed, last, ACCENTED)).toMatchObject({
      status: "lost",
      answer: ACCENTED,
    });
  });
});

describe("the free Termo board judges a guess with no request (T-WEB-S701)", () => {
  it("types, submits and gets tiles back with zero fetch and zero writes", async () => {
    const { fetchMock, setItem } = stubNoIo();
    const [first = ""] = misses(WORD);
    const { result } = renderHook(() => useFreeTermoBoard(WORD));

    for (const letter of first) {
      act(() => {
        result.current.type(letter);
      });
    }
    await act(async () => {
      result.current.submit();
      await Promise.resolve();
    });

    expect(result.current.state.guesses).toEqual(rows([first], WORD));
    expect(result.current.state.answer).toBeUndefined();
    expect(result.current.state.status).toBe("playing");
    expect(result.current.used).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe("the free Termo screen plays to its card and goes again (T-WEB-S702)", () => {
  it("is tagged Modo livre, backs out to the index, wins to the solved card with the finished board and draws a new word", async () => {
    const { fetchMock, setItem } = stubNoIo();
    const seeds = [SEED, NEXT_SEED];
    const pickSeed = vi.fn(() => seeds.shift() ?? 0);

    const { container } = render(<TermoFreeScreen deps={{ pickSeed }} />);
    await flushGeneration();

    const back = screen.getByRole("link", {
      name: messages.freePlay.backToIndexAria,
    });
    expect(back).toHaveAttribute("href", routes.freePlay);
    expect(screen.getByText(messages.freePlay.modeTag)).toBeInTheDocument();
    expect(screen.queryByText(formatLongDate(FREE_PLAY_DATE))).toBeNull();

    await guess(WORD);

    expect(container.querySelector("main")).toHaveAttribute(
      "data-play-state",
      "solved",
    );
    expect(
      screen.getByText(messages.freePlay.solved.stamp),
    ).toBeInTheDocument();
    expect(screen.getByText("Modo livre · Termo")).toBeInTheDocument();
    expect(screen.getByText(WORD)).toBeInTheDocument();
    const won = normalizeWord(WORD);
    const winningRow = screen.getByRole("group", {
      name: messages.games.termo.play.rowAria(
        1,
        MAX_GUESSES,
        won,
        evaluateGuess(won, WORD),
      ),
    });
    expect(winningRow).toHaveTextContent(won);
    expect(screen.queryByRole("button", { name: /letra/i })).toBeNull();

    fireEvent.click(screen.getByText("Mais uma"));
    await flushGeneration();

    expect(pickSeed).toHaveBeenCalledTimes(2);
    expect(container.querySelector("main")).toHaveAttribute(
      "data-play-state",
      "playing",
    );
    await guess(NEXT_WORD);
    expect(screen.getByText(NEXT_WORD)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("loses after six misses to a card that says so and shows the word and the sixth row", async () => {
    const { container } = render(
      <TermoFreeScreen deps={{ pickSeed: () => SEED }} />,
    );
    await flushGeneration();

    for (const word of misses(WORD)) {
      await guess(word);
    }

    expect(container.querySelector("main")).toHaveAttribute(
      "data-play-state",
      "lost",
    );
    expect(screen.getByText(messages.freePlay.solved.lostStamp)).toBeVisible();
    expect(screen.queryByText(messages.freePlay.solved.stamp)).toBeNull();
    expect(screen.getByText(messages.freePlay.solved.wordLead)).toBeVisible();
    expect(screen.getByText(WORD)).toBeVisible();
    const last = misses(WORD).at(-1) ?? "";
    expect(
      screen.getByRole("group", {
        name: messages.games.termo.play.rowAria(
          MAX_GUESSES,
          MAX_GUESSES,
          last,
          evaluateGuess(last, WORD),
        ),
      }),
    ).toHaveTextContent(last);
  });
});

describe("the Termo play view takes its chrome, not an archive flag (T-WEB-S703)", () => {
  const back = { href: "/x", label: "← X", ariaLabel: "Voltar a X" };

  it("puts a tag where the date goes, and a note under the rules when given", () => {
    const play = renderHook(() => useFreeTermoBoard(WORD)).result.current;

    const tagged = render(
      <PlayView play={play} chrome={{ back, topTag: "Etiqueta" }} />,
    );
    expect(screen.getByRole("link", { name: back.ariaLabel })).toHaveAttribute(
      "href",
      back.href,
    );
    expect(screen.getByText("Etiqueta")).toBeInTheDocument();
    expect(screen.queryByText(formatLongDate(FREE_PLAY_DATE))).toBeNull();
    tagged.unmount();

    const noted = render(
      <PlaySkeleton
        date={FREE_PLAY_DATE}
        chrome={{ back, note: { text: "Nota", className: "n" } }}
      />,
    );
    expect(screen.getByText("Nota")).toHaveClass("n");
    expect(screen.getByText(formatLongDate(FREE_PLAY_DATE))).toBeVisible();
    noted.unmount();

    render(<PlayView play={play} />);
    expect(
      screen.getByRole("link", { name: messages.play.backAria }),
    ).toHaveAttribute("href", routes.home);
  });
});

describe("free play refuses a profanity form on the device, in every variant (T-WEB-S1077)", () => {
  it("Clássico, Dueto and Quarteto say “não está na lista” and play no row", async () => {
    expect(isValidGuess(PROFANITY, true)).toBe(true);
    const { fetchMock } = stubNoIo();
    const classico = renderHook(() => useFreeTermoBoard(WORD)).result;
    for (const letter of PROFANITY) {
      act(() => {
        classico.current.type(letter);
      });
    }
    await act(async () => {
      classico.current.submit();
      await Promise.resolve();
    });
    expect(classico.current.state.notice).toBe(
      messages.games.termo.play.notInList,
    );
    expect(classico.current.used).toBe(0);

    for (const variant of ["dueto", "quarteto"] as const) {
      const { boards, maxGuesses } = TERMO_VARIANTS[variant];
      const words = drawFreeTermoWords(SEED, boards);
      const board = renderHook(() => useTermoVariant(words, maxGuesses)).result;
      for (const letter of PROFANITY) {
        act(() => {
          board.current.type(letter);
        });
      }
      act(() => {
        board.current.submit();
      });
      expect(board.current.state.notice, variant).toBe(
        messages.games.termo.play.notInList,
      );
      expect(board.current.state.guesses, variant).toEqual([]);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
