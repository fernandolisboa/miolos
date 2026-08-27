import {
  dailyNonogramResponseSchema,
  type DailyNonogramResponse,
  type DayResponse,
} from "@miolos/core";
import { generateNonogram } from "@miolos/games/nonogram";
import { act, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "../src/i18n";
import { solutionMarks } from "../src/nonogram/engine";
import {
  playRecordKey,
  type NonogramPlayRecord,
} from "../src/play/play-record";
import type { NonogramMark } from "../src/nonogram/state";
import { bodyOf, decl, stylesheet } from "./css-source";
import { withoutComments } from "./ts-source";

const DATE = "2026-08-01";
const API_URL = "https://api.example.test";

const MOTIF = "MOTIVO-MARCADOR-64";

const SMALL = daily(generateNonogram(20_260_801, 1));

function daily(puzzle: {
  readonly size: number;
  readonly clues: unknown;
}): DailyNonogramResponse {
  return dailyNonogramResponseSchema.parse({
    game: "nonogram",
    date: DATE,
    size: puzzle.size,
    clues: puzzle.clues,
  });
}

function solutionOf(fixture: DailyNonogramResponse): readonly NonogramMark[] {
  const marks = solutionMarks(fixture.clues);
  if (marks === null) {
    throw new Error("a published daily solves by construction");
  }
  return marks;
}

const SOLUTION = solutionOf(SMALL);

function concludedRecord(
  overrides: Partial<NonogramPlayRecord> = {},
): NonogramPlayRecord {
  const entries = SOLUTION.map((mark) => (mark === 1 ? 1 : null));
  return {
    v: 1,
    game: "nonogram",
    date: DATE,
    size: SMALL.size,
    entries,
    grid: [...SOLUTION],
    elapsedMs: 272_000,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

function dayBody(
  nonogram: DayResponse["games"]["nonogram"],
  date: string = DATE,
): DayResponse {
  return {
    date,
    games: {
      termo: { status: "pending" },
      sudoku: { status: "pending" },
      nonogram,
      binairo: { status: "pending" },
    },
  };
}

function completedClaim(motifName?: string): DayResponse["games"]["nonogram"] {
  return {
    status: "completed",
    elapsedMs: 272_000,
    hintsUsed: 0,
    ...(motifName === undefined ? {} : { motifName }),
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function urlOf(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : String(input);
}

function stubApi(day: () => Response) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    if (urlOf(input) === `${API_URL}/day`) {
      return Promise.resolve(day());
    }
    return Promise.resolve(jsonResponse(401, { error: "no-session" }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function loadConclusion() {
  return (await import("../src/nonogram/nonogram-conclusion"))
    .NonogramConclusion;
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function caption(): HTMLElement | null {
  return screen.queryByText(MOTIF);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${DATE}T12:00:00Z`));
  window.localStorage.clear();
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  window.localStorage.clear();
});

describe("the named reveal on the daily conclusion (T-WEB-S323)", () => {
  it("captions the picture with the lead and the name, and re-labels the figure", async () => {
    stubApi(() => jsonResponse(200, dayBody(completedClaim(MOTIF))));
    window.localStorage.setItem(
      playRecordKey("nonogram", DATE),
      JSON.stringify(concludedRecord()),
    );
    const NonogramConclusion = await loadConclusion();

    render(<NonogramConclusion date={DATE} />);
    await flush();

    await waitFor(() => {
      expect(caption()).toBeInTheDocument();
    });
    expect(
      screen.getByText(messages.games.nonogram.reveal.lead),
    ).toBeInTheDocument();

    const name = caption();
    expect(name?.tagName).toBe("P");
    expect(name).not.toHaveAttribute("role", "heading");
    expect(
      screen.queryByRole("heading", { name: MOTIF }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("img", {
        name: messages.games.nonogram.reveal.namedAria(MOTIF),
      }),
    ).toBeInTheDocument();

    for (const region of screen.queryAllByRole("status")) {
      expect(region).not.toHaveTextContent(MOTIF);
    }
  });
});

describe("the unnamed reveal is the honest degraded case (T-WEB-S324)", () => {
  it("renders exactly today's pre-#64 conclusion when no name is published", async () => {
    stubApi(() => jsonResponse(200, dayBody(completedClaim())));
    window.localStorage.setItem(
      playRecordKey("nonogram", DATE),
      JSON.stringify(concludedRecord()),
    );
    const NonogramConclusion = await loadConclusion();

    render(<NonogramConclusion date={DATE} />);
    await flush();

    expect(
      screen.getByRole("img", { name: messages.games.nonogram.reveal.aria }),
    ).toBeInTheDocument();
    expect(caption()).not.toBeInTheDocument();
    expect(
      screen.queryByText(messages.games.nonogram.reveal.lead),
    ).not.toBeInTheDocument();

    vi.resetModules();
    stubApi(() => jsonResponse(401, { error: "no-session" }));
    const Fresh = await loadConclusion();
    const { unmount } = render(<Fresh date={DATE} />);
    await flush();
    expect(
      screen.getAllByRole("img", {
        name: messages.games.nonogram.reveal.aria,
      }).length,
    ).toBeGreaterThan(0);
    expect(caption()).not.toBeInTheDocument();
    unmount();
  });
});

describe("a name that lands AFTER mount (T-WEB-S325)", () => {
  it("re-labels the already-mounted figure — the named accessible-name residual", async () => {
    let motifName: string | undefined = undefined;
    stubApi(() => jsonResponse(200, dayBody(completedClaim(motifName))));
    window.localStorage.setItem(
      playRecordKey("nonogram", DATE),
      JSON.stringify(concludedRecord()),
    );
    const NonogramConclusion = await loadConclusion();

    render(<NonogramConclusion date={DATE} />);
    await flush();

    expect(
      screen.getByRole("img", { name: messages.games.nonogram.reveal.aria }),
    ).toBeInTheDocument();
    expect(caption()).not.toBeInTheDocument();

    motifName = MOTIF;
    window.dispatchEvent(new Event("focus"));
    await flush();

    await waitFor(() => {
      expect(caption()).toBeInTheDocument();
    });
    expect(
      screen.getByRole("img", {
        name: messages.games.nonogram.reveal.namedAria(MOTIF),
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("img", {
        name: messages.games.nonogram.reveal.aria,
      }),
    ).not.toBeInTheDocument();
  });
});

describe("the name is composed once, in the wrapper (T-WEB-S326)", () => {
  it("composes AFTER the `fromRecord ?? picture` precedence, and the play screen composes none", async () => {
    stubApi(() => jsonResponse(200, dayBody(completedClaim(MOTIF))));
    const NonogramConclusion = await loadConclusion();

    render(
      <NonogramConclusion
        date={DATE}

        result={{ elapsedMs: 272_000, hintsUsed: 0 }}
        picture={{
          size: SMALL.size,
          cells: SOLUTION.map((mark) => (mark === 1 ? 1 : 0)),
          label: messages.games.nonogram.reveal.aria,
        }}
      />,
    );
    await flush();

    await waitFor(() => {
      expect(caption()).toBeInTheDocument();
    });

    expect(screen.getAllByText(MOTIF)).toHaveLength(1);
    expect(
      screen.getAllByText(messages.games.nonogram.reveal.lead),
    ).toHaveLength(1);

    const source = (path: string) =>
      withoutComments(
        readFileSync(join(import.meta.dirname, "..", path), "utf8"),
      );
    const screenSource = source("src/nonogram/nonogram-screen.tsx");
    expect(screenSource).not.toContain("motifName");
    expect(screenSource).not.toContain("namedAria");

    expect(screenSource).toContain("useServerDayClaim");

    const wrapper = source("src/nonogram/nonogram-conclusion.tsx");
    expect(wrapper.split("namedAria")).toHaveLength(2);
    expect(wrapper.split("reveal.lead")).toHaveLength(2);

    const shared = source("src/play/conclusion-view.tsx");
    expect(shared).not.toContain("messages.games.nonogram");
    expect(shared).toContain("messages.games.termo.outcome");

    expect(shared).toContain("refreshServerDay()");
  });
});

describe("no motif name reaches server markup (T-WEB-S327)", () => {
  it("`/nonogram/concluido` renders none, even with the store already holding one", async () => {
    stubApi(() => jsonResponse(200, dayBody(completedClaim(MOTIF))));
    window.localStorage.setItem(
      playRecordKey("nonogram", DATE),
      JSON.stringify(concludedRecord()),
    );
    const NonogramConclusion = await loadConclusion();

    const { unmount } = render(<NonogramConclusion date={DATE} />);
    await flush();
    await waitFor(() => {
      expect(caption()).toBeInTheDocument();
    });
    unmount();

    const markup = renderToStaticMarkup(<NonogramConclusion date={DATE} />);
    expect(markup.length).toBeGreaterThan(0);
    expect(markup).not.toContain(MOTIF);
    expect(markup).not.toContain(messages.games.nonogram.reveal.lead);

    const page = withoutComments(
      readFileSync(
        join(import.meta.dirname, "..", "app/nonogram/concluido/page.tsx"),
        "utf8",
      ),
    );

    expect(page).toContain("<NonogramConclusion date={daily.date} />");
    expect(page).not.toContain("motifName");
    expect(page).not.toContain("useServerDayClaim");
  });
});

describe("the payoff-moment refresh (T-WEB-S329)", () => {
  async function waitOutRecordPoll(): Promise<void> {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1300));
    });
  }

  it("a completion that settles `recorded` AFTER mount asks the store for today's truth", async () => {
    const fetchMock = stubApi(() =>
      jsonResponse(200, dayBody(completedClaim(MOTIF))),
    );
    const dayCalls = () =>
      fetchMock.mock.calls.filter((call) => urlOf(call[0]) === `${API_URL}/day`)
        .length;

    const { writePlayRecord } = await import("../src/play/play-record");
    window.localStorage.setItem(
      playRecordKey("nonogram", DATE),
      JSON.stringify(concludedRecord({ syncOutcome: "pending" })),
    );
    const NonogramConclusion = await loadConclusion();

    const view = render(<NonogramConclusion date={DATE} />);
    await flush();
    const afterMount = dayCalls();

    expect(afterMount).toBeGreaterThanOrEqual(1);

    writePlayRecord(concludedRecord({ syncOutcome: "recorded" }));
    await waitOutRecordPoll();
    await flush();

    expect(dayCalls()).toBeGreaterThan(afterMount);

    const afterNudge = dayCalls();
    view.rerender(<NonogramConclusion date={DATE} />);
    view.rerender(<NonogramConclusion date={DATE} />);
    await flush();
    expect(dayCalls()).toBe(afterNudge);
    view.unmount();
  });

  it("a `rejected` settle asks for nothing", async () => {
    const fetchMock = stubApi(() =>
      jsonResponse(200, dayBody(completedClaim(MOTIF))),
    );
    const dayCalls = () =>
      fetchMock.mock.calls.filter((call) => urlOf(call[0]) === `${API_URL}/day`)
        .length;

    const { writePlayRecord } = await import("../src/play/play-record");
    window.localStorage.setItem(
      playRecordKey("nonogram", DATE),
      JSON.stringify(concludedRecord({ syncOutcome: "pending" })),
    );
    const NonogramConclusion = await loadConclusion();

    const view = render(<NonogramConclusion date={DATE} />);
    await flush();
    const afterMount = dayCalls();
    expect(afterMount).toBeGreaterThanOrEqual(1);

    writePlayRecord(concludedRecord({ syncOutcome: "rejected" }));
    await waitOutRecordPoll();
    await flush();

    expect(dayCalls()).toBe(afterMount);
    view.unmount();
  });
});

describe("the caption's impeccable worst case (T-WEB-S330)", () => {
  it("no curated motif name can trip `all-caps-body` — measured over the whole shipped library, not over today's motif", () => {
    const sheet = stylesheet("src/play/conclusion-view.module.css");
    const uppercase = (selector: string) =>
      decl(bodyOf(sheet, selector), "text-transform") === "uppercase";

    expect(uppercase(".pictureName")).toBe(true);
    expect(uppercase(".pictureLead")).toBe(true);

    const ALL_CAPS_BODY_MAX = 30;
    expect(messages.games.nonogram.reveal.lead.length).toBeLessThanOrEqual(
      ALL_CAPS_BODY_MAX,
    );
  });
});
