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

/** The composer, spied THROUGH to the real implementation (T-WEB-S192a). */
const composed = vi.hoisted(() =>
  vi.fn<(record: PlayRecord, options: { readonly url: string }) => void>(),
);
vi.mock("../src/play/share-text", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/play/share-text")>();
  return {
    buildShareText: (record: PlayRecord, options: { readonly url: string }) => {
      composed(record, options);
      return actual.buildShareText(record, options);
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
  it("renders its box either way, and is disabled while `stored` is undefined", () => {
    // The in-place swap's one-commit window, reproduced exactly: the stamp
    // comes from the `result` prop and there is no record in storage yet.
    const { unmount } = render(
      view("binairo", { result: { elapsedMs: 407_000, hintsUsed: 0 } }),
    );
    const gated = shareButton();
    expect(gated, "the box is reserved, not withheld").not.toBeNull();
    expect(gated).toBeDisabled();
    // And the status region is reserved with it, so nothing reflows later.
    expect(shareStatus(gated as HTMLElement)).not.toBeNull();
    unmount();

    writePlayRecord(binairo());
    render(view("binairo"));
    expect(shareButton()).toBeEnabled();
  });

  it("a click in that window composes nothing", async () => {
    render(view("binairo", { result: { elapsedMs: 407_000, hintsUsed: 0 } }));
    (shareButton() as HTMLButtonElement).click();
    await Promise.resolve();
    expect(composed).not.toHaveBeenCalled();
    expect(shareMock).not.toHaveBeenCalled();
    expect(writeTextMock).not.toHaveBeenCalled();
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
