import { MAX_GUESSES } from "@miolos/games/termo";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "../src/i18n";
import { ConclusionView } from "../src/play/conclusion-view";
import styles from "../src/play/conclusion-view.module.css";
import {
  playRecordKey,
  playRecordSchema,
  termoPlayRecordSchema,
  type TermoPlayRecord,
} from "../src/play/play-record";
import type { ConclusionAnswer, ConclusionOutcome } from "../src/play/types";
import { TermoConclusion } from "../src/termo/termo-conclusion";
import { bodyOf, decl, pixels, stylesheet } from "./css-source";

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve(undefined)),
}));
vi.mock("../src/play/sync", () => sync);

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/termo/concluido",
}));

const DATE = "2026-08-01";
const ANSWER = "avião";
const copy = messages.games.termo;

function record(
  outcome: "won" | "lost",
  rows: number,
  overrides: Record<string, unknown> = {},
): TermoPlayRecord {
  return termoPlayRecordSchema.parse({
    v: 1,
    game: "termo",
    date: DATE,
    guesses: Array.from({ length: rows }, (_unused, index) => ({
      guess: "cafes",
      tiles:
        outcome === "won" && index === rows - 1
          ? ["correct", "correct", "correct", "correct", "correct"]
          : ["correct", "present", "absent", "absent", "absent"],
    })),
    answer: ANSWER,
    outcome,
    elapsedMs: 188_000,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  });
}

function store(value: TermoPlayRecord): void {
  localStorage.setItem(playRecordKey("termo", DATE), JSON.stringify(value));
}

function stateOf(container: HTMLElement): string | null | undefined {
  return container
    .querySelector("[data-conclusion-state]")
    ?.getAttribute("data-conclusion-state");
}

const DURATION = /\d{1,2}:\d{2}/;

function stampSlotText(container: HTMLElement): string | null | undefined {
  return container.querySelector(`.${styles.stampGuesses ?? ""}`)?.textContent;
}

const LOST: ConclusionOutcome = {
  state: "lost",
  label: copy.outcome.lostLabel,
  detail: copy.outcome.lostDetail(MAX_GUESSES),
  aria: copy.outcome.lostAria(MAX_GUESSES),
};

const WON: ConclusionOutcome = {
  state: "result",
  label: copy.outcome.wonLabel,
  detail: copy.outcome.wonDetail(4, MAX_GUESSES),
  aria: copy.outcome.wonAria(4, MAX_GUESSES),
};

const DAY_WORD: ConclusionAnswer = {
  result: copy.dayWord.won(4, MAX_GUESSES),
  lead: copy.dayWord.lead,
  canonical: ANSWER,
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("the fourth branch (T-WEB-S96)", () => {
  it("renders `lost` BEFORE the stamp branch, so a concluded loss never says Concluído", () => {
    store(record("lost", MAX_GUESSES));

    const { container } = render(<TermoConclusion date={DATE} />);

    expect(stateOf(container)).toBe("lost");
    expect(screen.getByText(copy.outcome.lostLabel)).toBeDefined();
    expect(container.textContent).not.toContain(messages.conclusion.stampLabel);
  });

  it("renders `lost` with NO ConclusionResult at all — the branch depends on nothing else", () => {
    const { container } = render(
      <ConclusionView
        game="termo"
        date={DATE}
        copy={copy.conclusion}
        outcome={LOST}
      />,
    );

    expect(stateOf(container)).toBe("lost");
  });

  it('gates on `outcome?.state === "lost"`, never on the prop\'s PRESENCE', () => {
    const { container } = render(
      <ConclusionView
        game="termo"
        date={DATE}
        copy={copy.conclusion}
        result={{ elapsedMs: 188_000, hintsUsed: 0 }}
        outcome={WON}
      />,
    );

    expect(stateOf(container)).toBe("result");
    expect(screen.getByText(copy.outcome.wonLabel)).toBeDefined();
    expect(
      screen.getByText(copy.outcome.wonDetail(4, MAX_GUESSES)),
    ).toBeDefined();
  });

  it("overrides the shipped triple on a win, and shows neither a time nor a hints line", () => {
    const { container } = render(
      <ConclusionView
        game="termo"
        date={DATE}
        copy={copy.conclusion}
        result={{ elapsedMs: 188_000, hintsUsed: 0 }}
        outcome={WON}
      />,
    );

    expect(container.textContent).not.toContain("03:08");
    expect(container.innerHTML).not.toMatch(DURATION);
    expect(container.textContent).not.toContain(messages.conclusion.hints(0));
    expect(container.querySelector(`.${styles.stampHints ?? ""}`)).toBeNull();

    expect(stampSlotText(container)).toBe(
      copy.outcome.wonDetail(4, MAX_GUESSES),
    );
  });

  it("leaves the three shipped games byte-identical — they pass neither prop", () => {
    const { container } = render(
      <ConclusionView
        game="sudoku"
        date={DATE}
        copy={messages.games.sudoku.conclusion}
        result={{ elapsedMs: 188_000, hintsUsed: 0 }}
      />,
    );

    expect(stateOf(container)).toBe("result");
    expect(screen.getByText(messages.conclusion.stampLabel)).toBeDefined();
    expect(screen.getAllByText("03:08").length).toBeGreaterThan(0);
    expect(screen.getByText(messages.conclusion.hints(0))).toBeDefined();

    expect(container.querySelector(`.${styles.announcer ?? ""}`)).toBeNull();
    expect(
      screen.queryAllByRole("status").map((node) => node.textContent?.trim()),
    ).toEqual([""]);
    expect(container.querySelector(`.${styles.dayWordRow ?? ""}`)).toBeNull();
  });

  it("announces the terminal sentence VERBATIM, on both outcomes, composing nothing", () => {
    for (const outcome of [WON, LOST]) {
      const { container, unmount } = render(
        <ConclusionView
          game="termo"
          date={DATE}
          copy={copy.conclusion}
          result={{ elapsedMs: 188_000, hintsUsed: 0 }}
          outcome={outcome}
        />,
      );

      const region = container.querySelector(`.${styles.announcer ?? ""}`);
      expect(region, "the outcome announcer").not.toBeNull();
      expect(region?.textContent).toBe(outcome.aria);

      expect(document.activeElement).toBe(document.body);
      unmount();
    }
  });
});

describe("the loss stamp (T-WEB-S97)", () => {
  const css = stylesheet("src/play/conclusion-view.module.css");

  it("steps the ring down to 1.5px --ink-2 and declares NO animation of its own", () => {
    const lost = bodyOf(css, ".stampLost");
    expect(decl(lost, "border")).toBe("1.5px solid var(--ink-2)");
    expect(decl(lost, "color")).toBe("var(--ink-2)");
    expect(decl(lost, "animation")).toBeUndefined();

    expect(decl(bodyOf(css, ".stampStill"), "animation")).toBe("none");
    expect(css.indexOf(".stampStill")).toBeGreaterThan(css.indexOf(".stamp {"));
  });

  it("carries `.stampStill` on a loss and not on a win, derived from `state`", () => {
    const { container: lost } = render(
      <ConclusionView
        game="termo"
        date={DATE}
        copy={copy.conclusion}
        outcome={LOST}
      />,
    );
    expect(lost.querySelector(`.${styles.stampLost ?? ""}`)).not.toBeNull();
    expect(lost.querySelector(`.${styles.stampStill ?? ""}`)).not.toBeNull();

    const { container: won } = render(
      <ConclusionView
        game="termo"
        date={DATE}
        copy={copy.conclusion}
        result={{ elapsedMs: 188_000, hintsUsed: 0 }}
        outcome={WON}
      />,
    );
    expect(won.querySelector(`.${styles.stampLost ?? ""}`)).toBeNull();
    expect(won.querySelector(`.${styles.stampStill ?? ""}`)).toBeNull();
  });

  it("shows two slots, and no time-as-achievement framing anywhere on a loss", () => {
    const { container } = render(
      <ConclusionView
        game="termo"
        date={DATE}
        copy={copy.conclusion}
        result={{ elapsedMs: 188_000, hintsUsed: 0 }}
        outcome={LOST}
      />,
    );

    expect(container.querySelector(`.${styles.stampHints ?? ""}`)).toBeNull();
    expect(container.textContent).not.toContain("03:08");
    expect(container.innerHTML).not.toMatch(DURATION);
    expect(container.textContent).not.toContain(messages.conclusion.hints(0));

    expect(stampSlotText(container)).toBe(copy.outcome.lostDetail(MAX_GUESSES));
    expect(
      screen.getByText(copy.outcome.lostDetail(MAX_GUESSES)),
    ).toBeDefined();
  });
});

describe("the day's word (T-WEB-S98)", () => {
  const css = stylesheet("src/play/conclusion-view.module.css");

  it("is not card-like, so `nested-cards` returns on its first guard", () => {
    const row = bodyOf(css, ".dayWordRow");
    for (const property of [
      "background",
      "border",
      "border-radius",
      "box-shadow",
    ]) {
      expect(decl(row, property)).toBeUndefined();
    }
  });

  it("sits below the stamp's own slot, at both viewports", () => {
    expect(decl(bodyOf(css, ".stampGuesses"), "composes")).toBe("stampTime");
    expect(pixels(decl(bodyOf(css, ".dayWord"), "font-size"))).toBe(34);
    expect(pixels(decl(bodyOf(css, ".stampTime"), "font-size"))).toBe(40);
    const mobile = bodyOf(css, "@media (max-width: 768px)");
    expect(pixels(decl(bodyOf(mobile, ".dayWord"), "font-size"))).toBe(24);
    expect(pixels(decl(bodyOf(mobile, ".stampTime"), "font-size"))).toBe(28);
  });

  it("is a <p> and never a heading — the lead above it is `kicker-above-heading` shape", () => {
    const { container } = render(
      <ConclusionView
        game="termo"
        date={DATE}
        copy={copy.conclusion}
        result={{ elapsedMs: 188_000, hintsUsed: 0 }}
        outcome={WON}
        answer={DAY_WORD}
      />,
    );

    const word = screen.getByText(ANSWER);
    expect(word.tagName).toBe("P");
    expect(word.getAttribute("role")).toBeNull();
    expect(word.previousElementSibling?.textContent).toBe(copy.dayWord.lead);
    expect(container.querySelectorAll("h2, h3, h4")).toHaveLength(0);
  });

  it("renders on BOTH outcomes", () => {
    for (const outcome of [WON, LOST]) {
      const { unmount } = render(
        <ConclusionView
          game="termo"
          date={DATE}
          copy={copy.conclusion}
          result={{ elapsedMs: 188_000, hintsUsed: 0 }}
          outcome={outcome}
          answer={DAY_WORD}
        />,
      );
      expect(screen.getByText(ANSWER)).toBeDefined();
      expect(screen.getByText(copy.dayWord.lead)).toBeDefined();
      unmount();
    }
  });
});

describe("where the word comes from (T-WEB-S99)", () => {
  it("reads the record on /termo/concluido, where there is no live state", () => {
    store(record("won", 4));

    render(<TermoConclusion date={DATE} />);

    expect(screen.getByText(ANSWER)).toBeDefined();
    expect(screen.getByText(copy.dayWord.won(4, MAX_GUESSES))).toBeDefined();
    expect(
      screen.getByText(copy.outcome.wonDetail(4, MAX_GUESSES)),
    ).toBeDefined();
  });

  it("takes it from live state in place, before any record has been written", () => {
    render(
      <TermoConclusion
        date={DATE}
        result={{ elapsedMs: 188_000, hintsUsed: 0 }}
        live={{ won: false, used: MAX_GUESSES, canonical: ANSWER }}
      />,
    );

    expect(screen.getByText(ANSWER)).toBeDefined();
    expect(screen.getByText(copy.dayWord.lost(MAX_GUESSES))).toBeDefined();
    expect(screen.getByText(copy.outcome.lostLabel)).toBeDefined();
  });

  it("cannot render an empty word, because a concluded record without one is unparseable", () => {
    const closedWithoutAnswer = {
      ...record("won", 4),
      answer: undefined,
    };

    expect(playRecordSchema.safeParse(closedWithoutAnswer).success).toBe(false);
  });

  it("renders `empty` on a device with no record — never `lost`", () => {
    const { container } = render(<TermoConclusion date={DATE} />);

    expect(stateOf(container)).toBe("empty");
    expect(
      within(container).getByText(copy.conclusion.notYet.title),
    ).toBeDefined();
  });
});
