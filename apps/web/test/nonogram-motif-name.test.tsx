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

/**
 * The named Nonogram reveal (#64, ADR-0070, superseding ADR-0033 decision
 * 1's name clause): the motif's curated pt-BR name arrives on the user's own
 * completed `/day` claim and captions the picture on the daily conclusion.
 *
 * THE REGISTER IS `remote-conclusion.test.tsx`'s, and for its reasons: a
 * fake `Date`, records written under the rendered São Paulo day, the env
 * stub and the fetch stub as a mandatory pair, and every surface imported
 * DYNAMICALLY after `vi.resetModules()` — the day-truth store holds its
 * payload in a module-level slot, and a leak between cases would make the
 * "no name" pins vacuous.
 *
 * WHAT IS DELIBERATELY NOT HERE, so a later reader does not read the gaps as
 * oversights: the ARCHIVE (`/day` takes no date by design, and the archive's
 * late-result panel composes no reveal at all), FREE PLAY (permanently
 * unnamed — ADR-0046 consequence 1 as narrowed, not reversed), and the
 * cross-device REMOTE completed view (a name with no picture is a caption
 * for a missing image; ADR-0065 decision 1's honest-absence table gains a
 * second row instead). All three are recorded non-goals of #64.
 */

const DATE = "2026-08-01";
const API_URL = "https://api.example.test";

/**
 * A motif name no curated table holds. Every "the name is not here" scan
 * below looks for THIS string, so a hit is the leak and never a coincidence
 * — the marker discipline the route-ssr scans already use.
 */
const MOTIF = "MOTIVO-MARCADOR-64";

/** Weekday 1 is the 5×5 class — 0.0354 ms to generate and validate. */
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

/** The picture, narrowed by a throw rather than by a cast. */
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
  // Mutable by inference, because the schema's arrays are.
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

/** The completed nonogram claim, named or not. */
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

/**
 * Routes `/day`; every other route — `/stats`, `/streak`,
 * `/notifications/state` — gets the anonymous 401 each client degrades on. A
 * FRESH `Response` per call, because a body reads once.
 */
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

/** Drain the store's fetch and its promise hops. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function caption(): HTMLElement | null {
  return screen.queryByText(MOTIF);
}

/**
 * A module's source with its comments removed, for the scans below.
 *
 * IT IS NOT FASTIDIOUSNESS. A source scan that reads comments counts its own
 * documentation: every file #64 touches explains what it does and does not
 * do with `motifName`, so `not.toContain("motifName")` over raw text reds on
 * the sentence saying the name is absent. Stripping first is what lets those
 * comments say the true thing plainly instead of being written around the
 * scanner — `published.ts`'s clock-fragment scan strips for the same reason,
 * and its "the wording avoids the scanned phrase" note is the alternative
 * this replaces.
 *
 * SCANNED CHARACTER BY CHARACTER, AND THE TWO-REGEX VERSION IS A TRAP THIS
 * FILE ALREADY FELL INTO. The obvious spelling —
 * `.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")` — strips BLOCK
 * comments first, so a `/*` appearing inside a LINE comment opens a block
 * that runs to the next real close. This repo writes glob paths like
 * `src/day/` + `**` in prose constantly, and one of them sits in
 * `conclusion-view.tsx`'s own trigger comment: that version deleted **515 of
 * its 1478 lines**, including the `refreshServerDay()` call the trigger is
 * about and the whole skeleton branch, and the scans below went quietly
 * blind over the region they exist to police. Measured, not imagined.
 *
 * So: one pass, left to right, line comments winning on the line they open,
 * which is what a real tokenizer does. Still not a parser — a `//` or `/*`
 * inside a string literal or a regex would fool it — and that is checked
 * against the four scanned files rather than assumed, by the anti-vacuity
 * assertions at the call sites. It stays in this file rather than becoming a
 * shared utility, so the next scan has to make that check for itself.
 */
function withoutComments(source: string): string {
  let out = "";
  let inBlock = false;
  for (const line of source.split("\n")) {
    let kept = "";
    for (let i = 0; i < line.length; i += 1) {
      if (inBlock) {
        if (line.startsWith("*/", i)) {
          inBlock = false;
          i += 1;
        }
        continue;
      }
      if (line.startsWith("//", i)) {
        break;
      }
      if (line.startsWith("/*", i)) {
        inBlock = true;
        i += 1;
        continue;
      }
      kept += line[i];
    }
    out += `${kept}\n`;
  }
  return out;
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

    // The caption: the impersonal kicker over the name. The register is
    // Termo's `dayWordRow` one row over — the second person deliberately
    // does NOT appear here, it lives in the accessible label below.
    await waitFor(() => {
      expect(caption()).toBeInTheDocument();
    });
    expect(
      screen.getByText(messages.games.nonogram.reveal.lead),
    ).toBeInTheDocument();

    // NEITHER LINE IS A HEADING. `.pictureLead` sits immediately above
    // `.pictureName`, which is textbook `kicker-above-heading` shape; the
    // pair is legal only because that rule and `hero-eyebrow-chip` anchor
    // exclusively on `h1`–`h4` and `[role="heading"]`. Promoting the name to
    // an `<h2>` is the obvious "semantic improvement" and lights the rule up
    // at both viewports, on a card no URL-mode scan reaches.
    const name = caption();
    expect(name?.tagName).toBe("P");
    expect(name).not.toHaveAttribute("role", "heading");
    expect(
      screen.queryByRole("heading", { name: MOTIF }),
    ).not.toBeInTheDocument();

    // And the figure's accessible name is the NAMED composition, not the
    // description — this is ADR-0033 consequence (a) discharged.
    expect(
      screen.getByRole("img", {
        name: messages.games.nonogram.reveal.namedAria(MOTIF),
      }),
    ).toBeInTheDocument();

    // NOT A LIVE REGION: the announcer's text is a prop composed before
    // mount and no transition writes it (the DISJOINT-WRITERS rule,
    // ADR-0042 decision 10 / ADR-0054 decision 4). A caption appearing is
    // not a status, and nothing here may claim to be one.
    for (const region of screen.queryAllByRole("status")) {
      expect(region).not.toHaveTextContent(MOTIF);
    }
  });
});

describe("the unnamed reveal is the honest degraded case (T-WEB-S324)", () => {
  it("renders exactly today's pre-#64 conclusion when no name is published", async () => {
    // Every real path that lands here: an offline finish, any pre-sync
    // paint, a deploy-skewed old server, a killed or missing daily row. All
    // four reach the client as a completed claim with no `motifName`, and
    // the card must render what shipped before #64 rather than a gap where
    // a caption should be.
    stubApi(() => jsonResponse(200, dayBody(completedClaim())));
    window.localStorage.setItem(
      playRecordKey("nonogram", DATE),
      JSON.stringify(concludedRecord()),
    );
    const NonogramConclusion = await loadConclusion();

    render(<NonogramConclusion date={DATE} />);
    await flush();

    // The composed DESCRIPTION, unchanged — never a fabricated name and
    // never an empty caption.
    expect(
      screen.getByRole("img", { name: messages.games.nonogram.reveal.aria }),
    ).toBeInTheDocument();
    expect(caption()).not.toBeInTheDocument();
    expect(
      screen.queryByText(messages.games.nonogram.reveal.lead),
    ).not.toBeInTheDocument();

    // A 401 — the cold-profile and offline case — is the same render, and
    // proves the caption's absence is not an artefact of this one body.
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
    // The offline finish that syncs later, which is the ordinary shape of
    // this feature rather than an edge: the picture mounts with the composed
    // description, and the name arrives on a later payload.
    //
    // ADR-0070 NAMES THE RESIDUAL THIS PINS: the accessible name of an
    // already-mounted `<svg role="img">` changes. That is legal — it is not
    // a live-region write, so the DISJOINT-WRITERS rule is untouched — and a
    // post-mount accessible-name mutation is an AT pitfall, so it is
    // recorded rather than discovered.
    // Initialised explicitly: `let x;` with a single later assignment reads
    // to `prefer-const` as a constant, and it is not one — the stub below
    // reads it afresh on every fetch, which is the whole mechanism here.
    let motifName: string | undefined = undefined;
    stubApi(() => jsonResponse(200, dayBody(completedClaim(motifName))));
    window.localStorage.setItem(
      playRecordKey("nonogram", DATE),
      JSON.stringify(concludedRecord()),
    );
    const NonogramConclusion = await loadConclusion();

    render(<NonogramConclusion date={DATE} />);
    await flush();

    // BEFORE: described, not named.
    expect(
      screen.getByRole("img", { name: messages.games.nonogram.reveal.aria }),
    ).toBeInTheDocument();
    expect(caption()).not.toBeInTheDocument();

    motifName = MOTIF;
    window.dispatchEvent(new Event("focus"));
    await flush();

    // AFTER: the same figure, a different accessible name, plus the caption.
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
    // The precedence matters and is the reason the composition is not
    // written into the ternary that builds `fromRecord`: the record wins on
    // every path but the in-place first paint and the throwing-storage case,
    // so naming one arm would leave a live arm unnamed and produce a caption
    // that appears and disappears across a single commit.
    //
    // The PROP arm — no record at all, the way `/nonogram`'s in-place swap
    // and the localStorage-throws case both reach this component — is named
    // exactly like the record arm.
    stubApi(() => jsonResponse(200, dayBody(completedClaim(MOTIF))));
    const NonogramConclusion = await loadConclusion();

    render(
      <NonogramConclusion
        date={DATE}
        // `result` travels with `picture` on this path: the in-place swap
        // hands both down from live play state, and without it the shared
        // view renders the "ainda não concluiu" card, which has no picture
        // slot at all and would make this test about the wrong branch.
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
    // ONCE: one caption element, not one per arm.
    expect(screen.getAllByText(MOTIF)).toHaveLength(1);
    expect(
      screen.getAllByText(messages.games.nonogram.reveal.lead),
    ).toHaveLength(1);

    // THE SOURCE SCAN, and it is the half a render cannot prove: the play
    // screen composes NO name. `nonogram-screen.tsx` hoists its own
    // `useServerDayClaim` for the remote-view branch and must not grow a
    // second composition — two would be a second spelling of the same rule,
    // free to drift. The conclusion WRAPPER is the only site.
    const source = (path: string) =>
      withoutComments(
        readFileSync(join(import.meta.dirname, "..", path), "utf8"),
      );
    const screenSource = source("src/nonogram/nonogram-screen.tsx");
    expect(screenSource).not.toContain("motifName");
    expect(screenSource).not.toContain("namedAria");
    // Anti-vacuity: the stripper must not have eaten the file. The play
    // screen's own hoisted claim read is still there — it serves the
    // remote-view branch — and its presence is what makes the two negatives
    // above mean "composes no name" rather than "reads no claim".
    expect(screenSource).toContain("useServerDayClaim");

    const wrapper = source("src/nonogram/nonogram-conclusion.tsx");
    expect(wrapper.split("namedAria")).toHaveLength(2);
    expect(wrapper.split("reveal.lead")).toHaveLength(2);

    // And the shared conclusion reads NO Nonogram string out of the i18n
    // bundle: it renders what it is handed. The scanned path is exact, and
    // both looser spellings were tried and rejected as false —
    // `messages.conclusion.dayCard.games.nonogram` is shared chrome that
    // legitimately lives there, and `messages.games.` matches
    // `RemoteTermoStamp`, which is the ONE per-game branch that module's own
    // TSDoc permits. The claim #64 makes is about this game, and the
    // assertion says exactly that and nothing wider.
    const shared = source("src/play/conclusion-view.tsx");
    expect(shared).not.toContain("messages.games.nonogram");
    expect(shared).toContain("messages.games.termo.outcome");
    // ANTI-VACUITY, and it is here because the stripper WAS broken and this
    // is the assertion that would have caught it: `refreshServerDay(` sits in
    // the middle of the region the two-regex stripper silently deleted. If a
    // future edit reintroduces that bug, the negative above goes blind and
    // this line goes red instead of nothing happening.
    expect(shared).toContain("refreshServerDay()");
  });
});

describe("no motif name reaches server markup (T-WEB-S327)", () => {
  it("`/nonogram/concluido` renders none, even with the store already holding one", async () => {
    // THE LANDMINE-1 PIN. `/nonogram/concluido` renders for players who have
    // NOT solved, and its RSC payload is a spoiler channel if anything
    // day-specific is computed on the server (ADR-0004, ADR-0034 decision
    // 3). The name is safe by CONSTRUCTION rather than by care —
    // `useSyncExternalStore`'s server snapshot is `undefined`, so no server
    // render can see the store — and this proves the construction rather
    // than trusting it.
    stubApi(() => jsonResponse(200, dayBody(completedClaim(MOTIF))));
    window.localStorage.setItem(
      playRecordKey("nonogram", DATE),
      JSON.stringify(concludedRecord()),
    );
    const NonogramConclusion = await loadConclusion();

    // Prime the store on the CLIENT first, and assert the name is really
    // there — the anti-vacuity half. Without it the scan below would pass
    // over a store that simply never held a name.
    const { unmount } = render(<NonogramConclusion date={DATE} />);
    await flush();
    await waitFor(() => {
      expect(caption()).toBeInTheDocument();
    });
    unmount();

    // Same module instance, same primed store, rendered as the server
    // renders it.
    const markup = renderToStaticMarkup(<NonogramConclusion date={DATE} />);
    expect(markup.length).toBeGreaterThan(0);
    expect(markup).not.toContain(MOTIF);
    expect(markup).not.toContain(messages.games.nonogram.reveal.lead);

    // The segment itself still hands the client tree the DATE and nothing
    // else — the rule that made the picture safe, restated for the name.
    const page = withoutComments(
      readFileSync(
        join(import.meta.dirname, "..", "app/nonogram/concluido/page.tsx"),
        "utf8",
      ),
    );
    // Anti-vacuity first: the segment really is the one under test, and the
    // stripper left its body intact.
    expect(page).toContain("<NonogramConclusion date={daily.date} />");
    expect(page).not.toContain("motifName");
    expect(page).not.toContain("useServerDayClaim");
  });
});

describe("the payoff-moment refresh (T-WEB-S329)", () => {
  /**
   * The record poll is 1 s (`use-record-snapshot.ts`), and this suite fakes
   * only `Date`, so `setTimeout` is real and has to be waited out for a
   * record written after mount to reach the component.
   */
  async function waitOutRecordPoll(): Promise<void> {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1300));
    });
  }

  it("a completion that settles `recorded` AFTER mount asks the store for today's truth", async () => {
    // Without this the just-solved player waits up to 60 s for the poll to
    // reveal the name on the one screen whose whole point is the payoff. The
    // refetch is honest independent of #64: a recorded completion means the
    // server's day truth genuinely changed.
    //
    // IT MUST BE A TRANSITION, and the first version of this test got that
    // wrong in a way worth recording. It mounted a record ALREADY carrying
    // `syncOutcome: "recorded"` and asserted the `/day` call count was
    // "between 1 and 2" — which admits the nudge never firing, and in that
    // scenario it provably never can: `useDayState`'s `useSyncExternalStore`
    // subscribe is hook-ordered BEFORE this effect and sets `inFlight`
    // synchronously, so a nudge at mount is always deduped away. A step-6
    // reviewer deleted decision 9 outright and the test stayed green.
    //
    // So the scenario here is the real payoff path: mount PENDING, let the
    // completion settle afterwards, and assert the count STRICTLY grew.
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
    // Anti-vacuity: the mount fetch really happened, so a later increase is
    // the nudge and not the store waking up for the first time.
    expect(afterMount).toBeGreaterThanOrEqual(1);

    // The sync lands: the same record, now recorded.
    writePlayRecord(concludedRecord({ syncOutcome: "recorded" }));
    await waitOutRecordPoll();
    await flush();

    expect(dayCalls()).toBeGreaterThan(afterMount);

    // AND IT DOES NOT FIRE AGAIN on re-renders that change nothing about the
    // settle — the property a dep-less effect would break, and the reason
    // the effect is keyed rather than bare.
    const afterNudge = dayCalls();
    view.rerender(<NonogramConclusion date={DATE} />);
    view.rerender(<NonogramConclusion date={DATE} />);
    await flush();
    expect(dayCalls()).toBe(afterNudge);
    view.unmount();
  });

  it("a `rejected` settle asks for nothing", async () => {
    // The negative half, on the same transition shape: a completion the
    // server refused changed no day truth, so it must buy no request.
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
    // THE #31 LESSON, applied before it costs anything. `all-caps-body` fires
    // on **> 30 chars of DIRECT text** under `text-transform: uppercase`,
    // with no interactive or `nav` exemption — and both caption lines are
    // uppercase. `.pictureLead` is a fixed string, but `.pictureName` renders
    // CONTENT: 184 curated names, a library that grows, on the one screen a
    // URL-mode impeccable scan can never reach (it needs a solved day, and a
    // clean profile's `/day` answers 401 — ADR-0065 consequence (c)'s
    // precedent). So the gate has to live here, measured over the worst case
    // rather than over whatever motif today happens to publish.
    //
    // Today: 184 names, longest "Bolo de aniversário" at 19. The margin is
    // 11 characters, and a 31-character motif added years from now must red
    // at commit time instead of at a preview scan nobody can run.
    //
    // THE CHECK IS TWO-SIDED, and this half deliberately does NOT enumerate
    // the names. `apps/web` may never import `MOTIFS` — that is exactly what
    // makes the bundle grep in `scripts/route-client-js.mjs` a real check on
    // tree-shaking, and #64 kept that grep armed rather than spending it
    // (ADR-0070 consequence (c)). So this side owns the CSS facts and the
    // threshold; `packages/games/test/nonogram/name-length.test.ts` owns the
    // library scan and cites this constant by name. The same arrangement
    // `bundle-markers.test.ts` and this script already use for the markers.
    const sheet = stylesheet("src/play/conclusion-view.module.css");
    const uppercase = (selector: string) =>
      decl(bodyOf(sheet, selector), "text-transform") === "uppercase";
    // Anti-vacuity: the threshold below only matters while these really are
    // uppercase. If a redesign drops the transform, this test should stop
    // claiming to guard anything.
    expect(uppercase(".pictureName")).toBe(true);
    expect(uppercase(".pictureLead")).toBe(true);

    // `ALL_CAPS_BODY_MAX` is the literal impeccable threshold, restated in
    // `packages/games/test/nonogram/name-length.test.ts`. When it moves,
    // both files move.
    const ALL_CAPS_BODY_MAX = 30;
    expect(messages.games.nonogram.reveal.lead.length).toBeLessThanOrEqual(
      ALL_CAPS_BODY_MAX,
    );
  });
});
