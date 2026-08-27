import type { Game } from "@miolos/core";
import { render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { archiveGameRoute, messages } from "../src/i18n";
import { ConclusionView } from "../src/play/conclusion-view";
import {
  writePlayRecord,
  type BinairoPlayRecord,
  type NonogramPlayRecord,
  type PlayRecord,
  type SudokuPlayRecord,
  type TermoPlayRecord,
} from "../src/play/play-record";
import type { ShareSubject } from "../src/play/share-text";
import { absoluteUrl } from "../src/site-origin";

vi.mock("../src/play/sync", () => ({
  startCompletionSync: () => () => undefined,
  flushPendingCompletions: () => Promise.resolve(),
}));
vi.mock("../src/streak/use-streak", () => ({ useStreak: () => null }));
vi.mock("../src/stats/use-stats", () => ({ useStats: () => null }));

const composed = vi.hoisted(() =>
  vi.fn<(subject: unknown, options: { readonly url: string }) => void>(),
);
vi.mock("../src/play/share-text", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/play/share-text")>();
  return {
    buildShareText: (
      subject: ShareSubject,
      options: { readonly url: string },
    ) => {
      composed(subject, options);
      return actual.buildShareText(subject, options);
    },
  };
});

const DATE = "2026-08-14";
const ORIGIN = "https://miolos.app";

let shareMock: ReturnType<typeof vi.fn>;
let writeTextMock: ReturnType<typeof vi.fn>;

function stubShare(implementation?: () => Promise<void>): void {
  shareMock = vi.fn(implementation ?? (() => Promise.resolve()));
  Object.defineProperty(navigator, "share", {
    value: shareMock,
    configurable: true,
    writable: true,
  });
}

function deleteShare(): void {
  Reflect.deleteProperty(navigator, "share");
}

function stubClipboard(implementation?: () => Promise<void>): void {
  writeTextMock = vi.fn(implementation ?? (() => Promise.resolve()));
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: writeTextMock },
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", ORIGIN);
  stubShare();
  stubClipboard();
});

afterEach(() => {
  vi.unstubAllEnvs();
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "clipboard");
});

const binairo = (): BinairoPlayRecord => ({
  v: 1,
  game: "binairo",
  date: DATE,
  entries: Array.from({ length: 64 }, () => null),
  elapsedMs: 407_000,
  hintsUsed: 0,
  concluded: true,
  pendingSync: false,
  syncOutcome: "recorded",
});

const sudoku = (): SudokuPlayRecord => ({
  v: 1,
  game: "sudoku",
  date: DATE,
  entries: Array.from({ length: 81 }, () => null),
  elapsedMs: 512_000,
  hintsUsed: 0,
  concluded: true,
  pendingSync: false,
  syncOutcome: "recorded",
});

const nonogram = (): NonogramPlayRecord => ({
  v: 1,
  game: "nonogram",
  date: DATE,
  size: 10,
  entries: Array.from({ length: 100 }, () => null),
  elapsedMs: 623_000,
  hintsUsed: 0,
  concluded: true,
  pendingSync: false,
  syncOutcome: "recorded",
});

const termo = (): TermoPlayRecord => ({
  v: 1,
  game: "termo",
  date: DATE,
  guesses: [
    {
      guess: "carta",
      tiles: ["absent", "present", "absent", "absent", "absent"],
    },
    {
      guess: "sonho",
      tiles: ["correct", "correct", "correct", "correct", "correct"],
    },
  ],
  answer: "sonho",
  outcome: "won",
  elapsedMs: 188_000,
  hintsUsed: 0,
  concluded: true,
  pendingSync: false,
  syncOutcome: "recorded",
});

const RECORDS: Readonly<Record<Game, () => PlayRecord>> = {
  binairo,
  sudoku,
  nonogram,
  termo,
};

const LOST = {
  state: "lost",
  label: "Jogado",
  detail: "X/6",
  aria: "Termo jogado, as 6 tentativas acabaram.",
} as const;

function view(
  game: Game,
  props: Partial<Parameters<typeof ConclusionView>[0]> = {},
) {
  return (
    <ConclusionView
      game={game}
      date={DATE}
      copy={messages.games[game].conclusion}
      {...props}
    />
  );
}

function shareButton(): HTMLButtonElement | null {
  return screen.queryByRole("button", { name: messages.share.label });
}

function shareStatus(button: HTMLElement): HTMLElement {
  const region = button.parentElement?.querySelector('p[role="status"]');
  if (!(region instanceof HTMLElement)) {
    throw new Error("the share button has no status region beside it");
  }
  return region;
}

describe("the share button renders in both terminal states and nowhere else (T-WEB-S194)", () => {
  it("is present in `result` and in `lost`", () => {
    writePlayRecord(binairo());
    const { unmount } = render(view("binairo"));
    expect(document.querySelector("[data-conclusion-state]")).toHaveAttribute(
      "data-conclusion-state",
      "result",
    );
    expect(shareButton()).not.toBeNull();
    unmount();

    writePlayRecord(termo());
    render(view("termo", { outcome: LOST }));
    expect(document.querySelector("[data-conclusion-state]")).toHaveAttribute(
      "data-conclusion-state",
      "lost",
    );
    expect(shareButton()).not.toBeNull();
  });

  it("is absent from `empty` and from `skeleton` — the dead-share-button rule, mechanically", () => {
    const { container } = render(view("binairo"));
    expect(container.querySelector("[data-conclusion-state]")).toHaveAttribute(
      "data-conclusion-state",
      "empty",
    );
    expect(shareButton()).toBeNull();

    const markup = renderToStaticMarkup(view("binairo"));
    expect(markup).toContain('data-conclusion-state="skeleton"');
    expect(markup).not.toContain(messages.share.label);
  });
});

describe("the button is disabled until the concluded record hydrates (T-WEB-S195)", () => {
  it("TERMO renders its box either way, and is disabled while `stored` is undefined", () => {
    //

    const { unmount } = render(
      view("termo", { result: { elapsedMs: 407_000, hintsUsed: 0 } }),
    );
    const gated = shareButton();
    expect(gated, "the box is reserved, not withheld").not.toBeNull();
    expect(gated).toBeDisabled();

    expect(shareStatus(gated as HTMLElement)).not.toBeNull();
    unmount();

    writePlayRecord(termo());
    render(view("termo"));
    expect(shareButton()).toBeEnabled();
  });

  it("a click in that window composes nothing", async () => {
    render(view("termo", { result: { elapsedMs: 407_000, hintsUsed: 0 } }));
    (shareButton() as HTMLButtonElement).click();
    await Promise.resolve();
    expect(composed).not.toHaveBeenCalled();
    expect(shareMock).not.toHaveBeenCalled();
    expect(writeTextMock).not.toHaveBeenCalled();
  });

  it("(a) the THREE GRID GAMES share from `result` with no record at all", async () => {
    for (const [game, elapsedMs] of [
      ["binairo", 407_000],
      ["sudoku", 512_000],
      ["nonogram", 613_000],
    ] as const) {
      vi.clearAllMocks();
      window.localStorage.clear();
      const { unmount } = render(
        view(game, { result: { elapsedMs, hintsUsed: 0 } }),
      );
      const button = shareButton();
      expect(button, game).not.toBeNull();
      expect(button, game).toBeEnabled();

      (button as HTMLButtonElement).click();
      await waitFor(() => {
        expect(composed, game).toHaveBeenCalledTimes(1);
      });

      expect(composed.mock.calls[0]?.[0], game).toEqual({
        game,
        date: DATE,
        elapsedMs,
      });
      const text = (shareMock.mock.calls[0]?.[0] as { text: string }).text;
      expect(text, game).toContain(messages.games[game].name);
      unmount();
    }
  });

  it("(b) TERMO with no store renders NOTHING rather than a permanently dead control", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("site data blocked");
      });

    const store = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("site data blocked");
      },
    });
    try {
      const { unmount } = render(
        view("termo", { result: { elapsedMs: 407_000, hintsUsed: 0 } }),
      );
      expect(shareButton()).toBeNull();

      expect(document.querySelector("[data-conclusion-state]")).toHaveAttribute(
        "data-conclusion-state",
        "result",
      );
      unmount();

      const grid = render(
        view("binairo", { result: { elapsedMs: 407_000, hintsUsed: 0 } }),
      );
      expect(shareButton()).toBeEnabled();
      grid.unmount();
    } finally {
      if (store !== undefined) {
        Object.defineProperty(window, "localStorage", store);
      }
      getItem.mockRestore();
    }
  });
});

describe("one string, two mechanisms, byte-identical (T-WEB-S196)", () => {
  it("prefers navigator.share, falls back to the clipboard, and both receive the same bytes", async () => {
    writePlayRecord(termo());
    const { unmount } = render(view("termo"));
    (shareButton() as HTMLButtonElement).click();
    await waitFor(() => {
      expect(shareMock).toHaveBeenCalledTimes(1);
    });
    expect(writeTextMock).not.toHaveBeenCalled();
    const shared: unknown = shareMock.mock.calls[0]?.[0];

    expect(Object.keys(shared as object)).toEqual(["text"]);
    const sharedText = (shared as { text: string }).text;
    unmount();

    vi.clearAllMocks();
    deleteShare();
    writePlayRecord(termo());
    render(view("termo"));
    (shareButton() as HTMLButtonElement).click();
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
    });

    expect(writeTextMock.mock.calls[0]?.[0]).toBe(sharedText);

    expect(sharedText).toContain(messages.brand.wordmark);
    expect(sharedText).toContain(messages.games.termo.name);
    expect(sharedText.split("\n").at(-1)).toBe(
      absoluteUrl(archiveGameRoute(DATE, "termo")),
    );
  });
});

describe("what the player is told, per rejection (T-WEB-S197)", () => {
  async function clickAndSettle(): Promise<HTMLElement> {
    const button = shareButton() as HTMLButtonElement;
    button.click();

    await waitFor(() => {
      expect(
        shareMock.mock.calls.length + writeTextMock.mock.calls.length,
      ).toBeGreaterThan(0);
    });
    return shareStatus(button);
  }

  it("an AbortError renders neither an error nor a confirmation", async () => {
    stubShare(() => Promise.reject(new DOMException("aborted", "AbortError")));
    writePlayRecord(binairo());
    render(view("binairo"));

    const region = await clickAndSettle();
    await Promise.resolve();
    expect(region.textContent?.trim()).toBe("");
    expect(region.textContent).not.toContain(messages.share.copied);
    expect(region.textContent).not.toContain(messages.share.failed);

    expect(writeTextMock).not.toHaveBeenCalled();
  });

  it("a NON-Abort rejection falls through to the clipboard", async () => {
    stubShare(() =>
      Promise.reject(new DOMException("no activation", "NotAllowedError")),
    );
    writePlayRecord(binairo());
    render(view("binairo"));

    const region = await clickAndSettle();
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(region).toHaveTextContent(messages.share.copied);
    });
  });

  it("a clipboard success is announced in an aria-live region", async () => {
    deleteShare();
    stubClipboard();
    writePlayRecord(sudoku());
    render(view("sudoku"));

    const region = await clickAndSettle();
    await waitFor(() => {
      expect(region).toHaveTextContent(messages.share.copied);
    });

    expect(region).toHaveAttribute("role", "status");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("a clipboard rejection renders the one failure the player can see", async () => {
    deleteShare();
    stubClipboard(() => Promise.reject(new Error("denied")));
    writePlayRecord(sudoku());
    render(view("sudoku"));

    const region = await clickAndSettle();
    await waitFor(() => {
      expect(region).toHaveTextContent(messages.share.failed);
    });
  });

  it("a SECOND copy re-announces and re-arms the timer", async () => {
    vi.useFakeTimers();
    try {
      deleteShare();
      stubClipboard();
      writePlayRecord(sudoku());
      render(view("sudoku"));
      const button = shareButton() as HTMLButtonElement;
      const region = shareStatus(button);

      button.click();
      await vi.advanceTimersByTimeAsync(0);
      expect(region).toHaveTextContent(messages.share.copied);

      await vi.advanceTimersByTimeAsync(4000);
      expect(region).toHaveTextContent(messages.share.copied);

      let settle = (): void => undefined;
      stubClipboard(
        () =>
          new Promise<void>((resolve) => {
            settle = resolve;
          }),
      );
      button.click();
      await vi.advanceTimersByTimeAsync(0);
      expect
        .soft(region.textContent?.trim(), "cleared before dispatch")
        .toBe("");
      settle();
      await vi.advanceTimersByTimeAsync(0);
      expect(region).toHaveTextContent(messages.share.copied);

      await vi.advanceTimersByTimeAsync(2000);
      expect.soft(writeTextMock).toHaveBeenCalledTimes(1);
      expect
        .soft(region, "the first copy's timer must not clear the second")
        .toHaveTextContent(messages.share.copied);

      await vi.advanceTimersByTimeAsync(4000);
      expect(region.textContent?.trim()).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a missing clipboard is a failure, not a crash", async () => {
    deleteShare();
    Reflect.deleteProperty(navigator, "clipboard");
    writePlayRecord(sudoku());
    render(view("sudoku"));

    const button = shareButton() as HTMLButtonElement;
    button.click();
    await waitFor(() => {
      expect(shareStatus(button)).toHaveTextContent(messages.share.failed);
    });
  });
});

describe("the call site builds the share URL from the shipped builders (T-WEB-S192a)", () => {
  it("hands the composer absoluteUrl(archiveGameRoute(date, game)) for all four games", async () => {
    for (const game of ["binairo", "sudoku", "nonogram", "termo"] as const) {
      vi.clearAllMocks();
      window.localStorage.clear();
      writePlayRecord(RECORDS[game]());
      const { unmount } = render(view(game));
      (shareButton() as HTMLButtonElement).click();
      await waitFor(() => {
        expect(composed, game).toHaveBeenCalledTimes(1);
      });

      expect(composed.mock.calls[0]?.[1], game).toEqual({
        url: absoluteUrl(archiveGameRoute(DATE, game)),
      });

      expect(composed.mock.calls[0]?.[1]?.url, game).toBe(
        `${ORIGIN}/arquivo/${DATE}/${game}`,
      );
      unmount();
    }
  });
});
