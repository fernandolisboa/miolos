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

/**
 * The conclusion's share button (#34, ADR-0054 decisions 1, 1a, 4 and 13).
 *
 * The composer's own contract is `share-text.test.ts`; what lives here is the
 * CONTROL — where it renders, when it is disabled, which of the two delivery
 * mechanisms a click reaches, and what the player is told afterwards.
 *
 * The two navigator members are stubbed with `Object.defineProperty`, because
 * jsdom implements neither and both are read-only accessors (plan 040 §9
 * landmines 1 and 2); at least one case runs with `navigator.share` genuinely
 * DELETED, which is the state every desktop browser is in. The client hooks
 * are mocked rather than `fetch`: the conclusion mounts `useStats` AND
 * `useStreak`, and one shared `Response` body cannot serve two consumers
 * (the napkin's shell item 3).
 */

vi.mock("../src/play/sync", () => ({
  startCompletionSync: () => () => undefined,
  flushPendingCompletions: () => Promise.resolve(),
}));
vi.mock("../src/streak/use-streak", () => ({ useStreak: () => null }));
vi.mock("../src/stats/use-stats", () => ({ useStats: () => null }));

/**
 * The composer, spied THROUGH to the real implementation (T-WEB-S192a).
 *
 * `ShareSubject`, not `PlayRecord`: since K3 the three grid games compose
 * from `{ game, date, elapsedMs }` when no record exists, and typing the spy
 * as a record would hide exactly the argument shape this file now asserts.
 */
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

/** `navigator.share` present and resolving, unless a case says otherwise. */
function stubShare(implementation?: () => Promise<void>): void {
  shareMock = vi.fn(implementation ?? (() => Promise.resolve()));
  Object.defineProperty(navigator, "share", {
    value: shareMock,
    configurable: true,
    writable: true,
  });
}

/** The state every desktop browser is in: the member does not exist at all. */
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

// ── fixtures ────────────────────────────────────────────────────────────

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

/** The lost-Termo props, the second of the two terminal states. */
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

/** The `aria-live` region that belongs to the button, not the loss stamp's. */
function shareStatus(button: HTMLElement): HTMLElement {
  const region = button.parentElement?.querySelector('p[role="status"]');
  if (!(region instanceof HTMLElement)) {
    throw new Error("the share button has no status region beside it");
  }
  return region;
}

// ── T-WEB-S194 ──────────────────────────────────────────────────────────

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
    // `empty`: hydrated, no concluded record, no `result`, no `outcome`.
    const { container } = render(view("binairo"));
    expect(container.querySelector("[data-conclusion-state]")).toHaveAttribute(
      "data-conclusion-state",
      "empty",
    );
    expect(shareButton()).toBeNull();

    // `skeleton`: the pre-hydration paint, which only the server snapshot
    // produces — `useRecordSnapshot`'s `SERVER_SNAPSHOT` is a constant that
    // says "not read yet", so `renderToStaticMarkup` is the way in.
    const markup = renderToStaticMarkup(view("binairo"));
    expect(markup).toContain('data-conclusion-state="skeleton"');
    expect(markup).not.toContain(messages.share.label);
  });
});

// ── T-WEB-S195 ──────────────────────────────────────────────────────────

describe("the button is disabled until the concluded record hydrates (T-WEB-S195)", () => {
  it("TERMO renders its box either way, and is disabled while `stored` is undefined", () => {
    // The in-place swap's one-commit window, reproduced exactly: the stamp
    // comes from the `result` prop and there is no record in storage yet.
    //
    // TERMO IS THE SUBJECT NOW, and the change of game is the whole of step-6
    // blocker K3: the grid games no longer need the record to share, so the
    // window they used to sit disabled through does not exist for them.
    // Termo's grid lives on `guesses[].tiles` and nowhere else, so it keeps
    // the gate — and the arm below proves the gate is momentary rather than
    // permanent.
    const { unmount } = render(
      view("termo", { result: { elapsedMs: 407_000, hintsUsed: 0 } }),
    );
    const gated = shareButton();
    expect(gated, "the box is reserved, not withheld").not.toBeNull();
    expect(gated).toBeDisabled();
    // And the status region is reserved with it, so nothing reflows later.
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
    // K3's fix, as a behaviour. Their whole share is a header and an elapsed
    // time, and `ConclusionResult` carries the elapsed time — so a store-less
    // browser (Safari private, site data blocked), where `readPlayRecord`
    // returns undefined FOREVER, gets a working control instead of one that
    // never enables and never explains itself.
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
      // Composed from the PROP, and the elapsed time really travelled: same
      // three fields the record path would have supplied.
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
    // The other half of K3. `readPlayRecord` returning undefined is two
    // different facts wearing one answer — "not written yet", which resolves
    // in a commit, and "this browser has no store", which never does — and
    // only the second one makes a gated control ADR-0045 :186-191's dead
    // share button. `playRecordsAvailable()` separates them, so the control
    // is omitted rather than shown broken.
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("site data blocked");
      });
    // The predicate reads `window.localStorage` itself, so the store has to
    // be gone rather than merely throwing on access.
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
      // The rest of the conclusion is untouched — this omits one control, it
      // does not fall back to the empty card.
      expect(document.querySelector("[data-conclusion-state]")).toHaveAttribute(
        "data-conclusion-state",
        "result",
      );
      unmount();

      // The counted floor, in the same environment: a GRID game still renders
      // its button there, so the omission above is Termo's own and not a
      // store-less screen rendering nothing at all.
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

// ── T-WEB-S196 ──────────────────────────────────────────────────────────

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
    // `text` only — no `url` member and no `title`: targets disagree about
    // both, and one field is what makes the byte-identity below testable.
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
    // Non-vacuity: the bytes really are the share text and not an empty
    // string that two mechanisms agree on.
    expect(sharedText).toContain(messages.brand.wordmark);
    expect(sharedText).toContain(messages.games.termo.name);
    expect(sharedText.split("\n").at(-1)).toBe(
      absoluteUrl(archiveGameRoute(DATE, "termo")),
    );
  });
});

// ── T-WEB-S197 ──────────────────────────────────────────────────────────

describe("what the player is told, per rejection (T-WEB-S197)", () => {
  async function clickAndSettle(): Promise<HTMLElement> {
    const button = shareButton() as HTMLButtonElement;
    button.click();
    // Two microtask turns: the delivery promise, then the state commit.
    await waitFor(() => {
      expect(
        shareMock.mock.calls.length + writeTextMock.mock.calls.length,
      ).toBeGreaterThan(0);
    });
    return shareStatus(button);
  }

  it("an AbortError renders neither an error nor a confirmation", async () => {
    // The player dismissed the sheet. Surfacing that as a failure is the
    // single most common bug in this feature.
    stubShare(() => Promise.reject(new DOMException("aborted", "AbortError")));
    writePlayRecord(binairo());
    render(view("binairo"));

    const region = await clickAndSettle();
    await Promise.resolve();
    expect(region.textContent?.trim()).toBe("");
    expect(region.textContent).not.toContain(messages.share.copied);
    expect(region.textContent).not.toContain(messages.share.failed);
    // And it never reached the clipboard: an abort is a decision, not a
    // failure to route around.
    expect(writeTextMock).not.toHaveBeenCalled();
  });

  it("a NON-Abort rejection falls through to the clipboard", async () => {
    // `NotAllowedError`, `DataError` and `TypeError` are real failures of the
    // sheet, and treating only Abort would make every one of them silent.
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
    // Announced, because nothing visible happened.
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
    // Step-6 finding K4. `setStatus("copied")` when the state is already
    // "copied" is a bail-out: React does not re-render, the `[status]` effect
    // does not re-run, so the FIRST copy's five-second timer keeps running and
    // clears the second copy's confirmation early — and `aria-live` announces
    // nothing at all, because the text never changed. Measured before the fix:
    // ARMED after the first click 1, after the second 1.
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

      // Four seconds in — the first timer has one second left.
      await vi.advanceTimersByTimeAsync(4000);
      expect(region).toHaveTextContent(messages.share.copied);

      // The second copy, with the clipboard held open, so the intermediate
      // state is observable: the handler clears the region BEFORE dispatching,
      // which is what gives the live region a change to speak and the effect a
      // reason to re-run.
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

      // Two seconds later the ORIGINAL timer would have fired. It must not
      // have taken the second confirmation with it.
      await vi.advanceTimersByTimeAsync(2000);
      expect.soft(writeTextMock).toHaveBeenCalledTimes(1);
      expect
        .soft(region, "the first copy's timer must not clear the second")
        .toHaveTextContent(messages.share.copied);

      // And the new timer does still expire on its own schedule.
      await vi.advanceTimersByTimeAsync(4000);
      expect(region.textContent?.trim()).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a missing clipboard is a failure, not a crash", async () => {
    // `navigator.clipboard` is undefined outside a secure context, and the
    // property access itself throws inside the handler.
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

// ── T-WEB-S192a ─────────────────────────────────────────────────────────

describe("the call site builds the share URL from the shipped builders (T-WEB-S192a)", () => {
  it("hands the composer absoluteUrl(archiveGameRoute(date, game)) for all four games", async () => {
    // The other half of T-WEB-S192's claim: the composer holds no route
    // knowledge, so the call site is the only place this can be asserted.
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
      // Spelled out once, so the assertion is not two builders agreeing
      // with themselves: the archive permalink, not `/<jogo>`, which serves
      // a different puzzle after the rollover (ADR-0053 decision 1).
      expect(composed.mock.calls[0]?.[1]?.url, game).toBe(
        `${ORIGIN}/arquivo/${DATE}/${game}`,
      );
      unmount();
    }
  });
});
