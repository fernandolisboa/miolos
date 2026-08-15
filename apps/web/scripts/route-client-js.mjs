#!/usr/bin/env node
/**
 * The per-route client-bundle tripwire (ADR-0027, ADR-0033 consequence (d),
 * plan 020 §20).
 *
 * WHAT IT MEASURES, AND WHY IT IS NOT A BESPOKE DERIVATION. Plan 020 §20.1
 * asserts that Next 16.2.12 "does not emit" per-route First Load JS and
 * supersedes ADR-0027's mandate on that ground. That premise is FALSE, and
 * this script is the correction: Next writes the figure to
 * `.next/diagnostics/route-bundle-stats.json` on every build
 * (`next/dist/build/route-bundle-stats.js`, `collectAppRouterStats`). It is
 * only the terminal table that no longer prints it. So the number below is
 * Next's own definition of First Load JS — `entryJSFiles ∪ rootMainFiles`,
 * summed — rather than a hand-rolled walk of
 * `page_client-reference-manifest.js` that would have to be re-argued every
 * time the manifest shape moves.
 *
 * WHY A DELTA AND NOT AN ABSOLUTE. The absolute figure is dominated by React,
 * Next's runtime and the shared app shell, none of which a game ticket
 * controls. What a game ticket controls is what its own route adds over `/`,
 * and that is what the ≤ 40 KB acceptance in §20.2 bounds.
 *
 * WHAT THE OTHER TWO PLAY ROUTES ARE, EXACTLY. Binairo's and sudoku's deltas
 * are PRINTED for comparison against the figures in the PR that last touched
 * them — they are not asserted, and calling them "regression controls" was
 * false: this script stores no baseline, so it structurally cannot compare a
 * delta to its previous value. The only failure surface below is the 40 KB
 * budget, and the headroom is NOT the "half of it" an earlier version of this
 * comment claimed: measured on this branch after #34's Batch E, the three
 * GRID play routes come in at binairo 35.3, sudoku 31.5 and nonogram 37.5 KB
 * — 88 %, 79 % and 94 % of budget — so the noisiest clean route has 2.5 KB of
 * slack, not 20. Note the direction, and note that the DELTA can move on a
 * ticket that touches no grid route at all: #19 grew `/` (the BASELINE,
 * hub-streak) AND the game routes (the conclusion streak card), and the card
 * side won by ~0.5 KB, so every measured delta moved UP a hair rather than
 * shrinking the instrument; #34 then moved all three UP by ~1.8 KB
 * (33.5 → 35.3, 29.7 → 31.5, 35.6 → 37.5, against `main` at `/` = 825.5 KB)
 * WITHOUT TOUCHING A GRID ROUTE — it grew EVERY route's absolute by
 * ~5.8–6.0 KB and `/` itself by only 4.1, because the copy deck in
 * `src/i18n/messages.ts` is on every route's client graph and the shared
 * chunks reshuffled around it. `/nonogram`'s slack went 4.4 → 2.5 KB on a
 * ticket whose whole diff is a conclusion button and some metadata, which is
 * the entire case for re-measuring these rather than quoting them.
 * (An earlier version of this paragraph quoted #19's 36.3 / 32.6 / 38.3 and
 * a 1.7 KB slack — already drifted to 33.5 / 29.7 / 35.6 on `main` by #34,
 * through three tickets that did not re-measure it — before that #28's 35.8 /
 * 32.1 / 37.8 and a 2.2 KB slack, before that #27's 33.0 / 30.4 / 36.8 and
 * a 3.2 KB one, and before that #25's 28.3 / 30.9 / 34.3 and a 5.7 KB one,
 * which overstated the room by 78 % in the one comment whose whole thesis is
 * that overstated room is the hazard; #28's free-play routes reshuffled the
 * shared chunks and moved all three.) It still
 * discriminates against what it exists to catch (a motif-table leak is
 * ~35 KB minified and would land /nonogram around 73 KB), but nobody may
 * budget against room that is not there, and the figures above are the ones
 * to re-measure rather than quote.
 * `/termo` is the ONE route that does not ride the shared constant — see
 * `PER_ROUTE_BUDGET` below, which is ADR-0045 decision 7. NOTE ALSO that
 * the 40 KB threshold was calibrated in plan 020 §20.2 under a DIFFERENT
 * measurement — clientModules ∪ rootMainFiles ∪ polyfillFiles, entryJSFiles
 * excluded, baselines 26.5/28.6 KB — while this script enforces it through
 * Next's own `firstLoadChunkPaths`, so §20.2's "~11 KB of headroom above the
 * noisiest clean route" does not carry over to these figures.
 * HISTORICALLY, across #25 — these are #25's numbers, superseded by the ones
 * above — the two shipped deltas moved 28.6 → 30.9 KB and 26.4 → 28.3 KB,
 * unchanged by that ticket's per-cell memo (which cost /nonogram 33.9 →
 * 34.3 KB), and the run printed `ok` for both, which is correct behaviour and
 * NOT a control firing. A real
 * control needs a committed per-route baseline; that was declined here because
 * plan 020 §20.2 scopes this instrument to one route in one PR rather than to
 * a standing rule #27 and #28 inherit, and a baseline file only earns its
 * maintenance once it is a standing rule.
 *
 * WHY THE GREPS ARE HALF OF IT. A size check alone cannot see the failure
 * this exists to catch. `@miolos/games/nonogram`'s barrel re-exports
 * `NONOGRAM_WEEKDAY_CRITERIA` from `difficulty.ts`, which imports the motif
 * tables at module scope — so one careless client-side import puts every
 * curated pt-BR picture name in the browser, and 59 KB is a delta a reviewer
 * might wave through. The name greps are the real check, and they only work
 * for as long as ADR-0033 holds that no motif name ships (consequence (d)).
 * The POSITIVE greps exist so a scan that quietly stopped looking at the
 * right files cannot pass by finding nothing.
 *
 * IT IS RUN BY HAND, and that is the whole of it. Nothing in CI, in
 * `turbo.json` or in a git hook invokes this file: a green CI is NOT evidence
 * that no motif name shipped. Plan 020 §20.2 scopes it deliberately — "a
 * per-PR tripwire for this route, not a standing rule #27 or #28 inherit" —
 * and its forbidden/expected marker arrays hard-code pt-BR product copy, which
 * as an unconditional CI step would red a build for a copy edit (#28
 * considered adding it to CI and declined again on the same ground, plan 025
 * §10.4). Run it at step 8 and paste the output in the PR; a reviewer reading
 * ADR-0027, ADR-0033 or ADR-0047 should read them the same way.
 *
 * Usage, from `apps/web`, after a build:
 *
 *     pnpm build && pnpm bundle-check
 *
 * Exits non-zero on: a route delta over budget, any forbidden marker present,
 * or any expected marker missing.
 */
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const NEXT_DIR = ".next";
const STATS = join(NEXT_DIR, "diagnostics", "route-bundle-stats.json");
const CHUNKS = join(NEXT_DIR, "static", "chunks");

/** The acceptance §20.2 sets for a play route's own client cost. */
const MAX_DELTA_BYTES = 40 * 1024;

/**
 * ADR-0045 decision 7, discharged: "the script moves to PER-ROUTE BUDGETS,
 * and `/termo`'s constant is set at step 8 from the measured route."
 *
 * `/termo` cannot ride the shared 40 KB and the shared constant must not be
 * raised to fit it — that would un-arm the motif tripwire for the three grid
 * routes, which is the only thing it exists for. Measured on this branch,
 * clean build after #28's step 7: /termo is +69.1 KB raw over `/`, against
 * +35.8 / +37.8 / +32.1 for binairo / nonogram / sudoku. The gap is not a
 * regression — it is the shared play-screen shell (~31 KB, in line with the
 * three siblings) plus the Termo library floor (~37.9 KB, of which ~36.4 KB
 * is the validation dictionary the ticket exists to ship, because "não está
 * na lista" has to be instant and offline).
 *
 * 76 KB leaves 6.9 KB — 9.1 % OF THE BUDGET, and the denominator is named
 * because ADR-0045:170 states the same convention (7.1 KB at #27's merge
 * candidate, the point-in-time measurement that ADR records) and two
 * denominators for one number is how a headroom claim drifts. Enough for
 * ordinary copy edits, tight
 * enough that a SECOND `packages/games` module lands it in the red. That is
 * the failure this arms against — someone importing a value from
 * `@miolos/games/termo` into `play-record.ts` (whose `212-244` block warns
 * about it by name, because that module is on every route's client graph)
 * would pass all three FORBIDDEN accent greps and every existing budget while
 * `/termo` grew silently.
 */
const PER_ROUTE_BUDGET = {
  "/termo": 76 * 1024,
  /**
   * #28 (ADR-0046/ADR-0047): free-play Nonogram is the `/termo` argument a
   * second time — the heavy content IS the feature. Generation needs the
   * motif tables (~35 KB minified, curated pt-BR names included), so the
   * route cannot ride the shared 40 KB, and the shared constant must not be
   * raised to fit it, because the default is what arms the motif tripwire
   * for the three DAILY grid routes. Measured after #28's step 7 on this
   * branch: +54.3 KB raw over `/`, against +18.3 / +18.3 for the free
   * binairo and sudoku (which ride the default with room to spare) and
   * −20.3 for the free-play index. 60 KB is measured + ~10% (plan 025 D12):
   * enough for
   * copy edits, tight enough that a second heavy library riding along
   * lands it in the red.
   */
  "/modo-livre/nonogram": 60 * 1024,
  // #31 (ADR-0053 decision 1): the archived Termo, at the SAME value `/termo`
  // carries and for the same ADR-0045 decision 7 reason — the ~36 KB
  // validation dictionary is the route's whole cost and it is the point of
  // the game. The date-first route shape is what keeps that dictionary off
  // the archived Sudoku: four separate build outputs, one per literal game
  // segment. Third entry in this map, not the second.
  "/arquivo/[data]/termo": 76 * 1024,
};

const BUDGETED = [
  "/binairo",
  "/nonogram",
  "/sudoku",
  "/termo",
  "/modo-livre",
  "/modo-livre/binairo",
  "/modo-livre/nonogram",
  "/modo-livre/sudoku",
  // #29: daily scope by default (not under /modo-livre), and BUDGETED under
  // the shared 40 KB because — unlike /privacidade — this route ships real
  // client JS (the stats island, both hooks and the month grouping) and
  // must be watched (plan 033 D11.4).
  "/estatisticas",
  // #31 (ADR-0053): the seven archive routes, in Next's own route-pattern
  // spelling (verified against `.next/diagnostics/route-bundle-stats.json`).
  //
  // The index, the month page and the day page ship near-zero client JS and
  // ride the shared 40 KB with enormous slack — measured at -38.7 KB against
  // `/`, i.e. LESS than the hub. They are BUDGETED anyway, because "ships
  // nothing today" is precisely the route that acquires a library silently.
  //
  // The three grid play routes came in BELOW their daily twins (binairo 18.2
  // vs 33.4, nonogram 19.7 vs 35.5, sudoku 14.4 vs 29.6), and the reason is
  // structural rather than lucky: the archive shells compose the per-game
  // hooks and views and never the screen ROOTS, so the whole conclusion tree
  // — `conclusion-view`, the two per-game conclusions, the streak card and
  // `day-state` — is outside their graphs (ADR-0053 decision 9, T-WEB-S183).
  // Plan 037's "named squeeze" on `/arquivo/[data]/nonogram` against a 40 KB
  // budget therefore did not materialise; it lands at 49 % of it.
  "/arquivo",
  "/arquivo/mes/[mes]",
  "/arquivo/[data]",
  "/arquivo/[data]/binairo",
  "/arquivo/[data]/nonogram",
  "/arquivo/[data]/sudoku",
  "/arquivo/[data]/termo",
  // #34 (ADR-0054): the four conclusion routes, which #34 is the first ticket
  // to ship real client JS to on purpose — the share button, its clipboard
  // fallback and its `aria-live` region. They ride the SHARED 40 KB with
  // room: measured on this branch after Batch E, +10.0 / +10.6 / +10.0 /
  // +11.5 KB for binairo / nonogram / sudoku / termo (from +8.3 / +8.9 /
  // +8.3 / +9.8 on `main`), i.e. 25–29 % of budget, so no `PER_ROUTE_BUDGET`
  // entry is owed and none is added. `/termo`'s is the largest of the four
  // and still nowhere near its daily twin's 68.6 — the conclusion never
  // imports the validation dictionary.
  //
  // They are BUDGETED for the reason the archive index is: a conclusion is
  // the screen a future ticket reaches for when it wants a chart, a medal
  // animation or a second sharing channel, and an unbudgeted route is the
  // one that acquires a library with nothing saying so.
  "/binairo/concluido",
  "/nonogram/concluido",
  "/sudoku/concluido",
  "/termo/concluido",
];

/**
 * The free-play route prefix that decides chunk attribution (ADR-0047).
 * Everything NOT under it is daily scope — new routes are daily-strict by
 * default, so forgetting to classify a future route fails closed.
 */
const FREE_PLAY_PREFIX = "/modo-livre";

/** The four routes #28 ships; a build missing one is a loud exit 2, never a
 *  vacuously-green scope (ADR-0047). */
const FREE_PLAY_ROUTES = [
  "/modo-livre",
  "/modo-livre/binairo",
  "/modo-livre/nonogram",
  "/modo-livre/sudoku",
];

const budgetFor = (route) => PER_ROUTE_BUDGET[route] ?? MAX_DELTA_BYTES;

/**
 * Strings that must NOT appear in any client chunk.
 *
 * The first group is curated motif content (ADR-0033: no name may reach
 * `apps/web`, which is what keeps this grep meaningful). The second is the
 * server-only daily-content schemas — their key strings and refine messages —
 * which `packages/core/src/contracts/daily-content.ts` plus that package's
 * `"sideEffects": false` keep out of the browser. A hit on the second group
 * means the split was undone or the flag was dropped.
 *
 * THE FIVE MOTIF MARKERS ARE PINNED ON THE OTHER SIDE, by
 * `packages/games/test/nonogram/bundle-markers.test.ts`. They are a copy of
 * library content and a grep for a name nobody uses any more passes
 * trivially — so that test asserts all five still resolve in `MOTIFS`, one per
 * size class plus the one id. When it reds, replace the marker in BOTH files.
 * The same two-way citation `clue-bounds.test.ts` carries for `WORST_ROW`.
 *
 * THE SECOND GROUP IS PINNED TOO, and the citation belongs here so a reader
 * of this file can find it (step-6 round-4 finding Q7). Four of the five are
 * schema KEYS — `motifId`, `givensCount`, `requiredTier`, `clueCount`, all
 * live in `packages/core/src/contracts/daily-content.ts` — so renaming one
 * breaks the schema loudly and the tests that parse real engine output go red
 * with it. The fifth, `"reveal.solution must be size x size"`, is free-text
 * `.refine` copy and had nothing behind it until step-6 round 3 (finding
 * NONO-Q2); `packages/core/test/daily-contract.test.ts` now asserts the exact
 * string on both the short and the ragged solution, naming this file as its
 * consumer. Change the message and that test reds before this grep can go
 * vacuous.
 *
 * THE THIRD GROUP IS #27'S, and it is a different kind of negative from the
 * other two (ADR-0045 decision 5). `então`, `mamãe` and `época` are Termo
 * ANSWER canonicals. Unlike a motif name, the module they live in is one
 * `apps/web` genuinely imports: `/termo` ships `isValidGuess` on purpose,
 * because "não está na lista" has to be instant and offline, and the
 * validation dictionary and the 400-word answer pool are the SAME generated
 * module. What keeps the pool out is two `/*#__PURE__*\/` annotations in
 * `packages/games/src/termo/word-list.ts`, which typecheck, lint and the whole
 * test suite are blind to and which ADR-0045's measurement E4 proves are
 * fragile to their own placement. This grep is the only instrument that can
 * see them work.
 *
 * The discriminator is the ACCENT: `content/termo/validation.txt` is US-ASCII,
 * so an accented canonical can only have come from `ANSWER_CANONICALS`. The
 * reason the pool must go is cost and strip-table integrity and it is
 * explicitly NOT confidentiality — ADR-0027:125-131 forecloses that register,
 * and nothing in #27 rests on the client not holding the pool.
 *
 * PINNED ON THE OTHER SIDE by `packages/games/test/termo/bundle-markers.test.ts`,
 * which proves all three still spell answers, that none is a validation word,
 * and that `zurro` below is one. When it reds, replace the marker in BOTH
 * files.
 */
/**
 * SCOPED SINCE #28 (ADR-0047, which amends ADR-0033's bundle clause).
 * Free play generates in the browser (ADR-0011/ADR-0046), so free-play
 * chunks legitimately carry the motif library and the generator output
 * keys — a single global list would fail by design on the first free-play
 * build, and raising or trimming it would un-arm the tripwire for the
 * three daily grid routes, the only thing it exists for. So markers carry
 * a scope, and chunks carry an attribution (see the scan below):
 *
 * - `FORBIDDEN_EVERYWHERE` — the Termo answer canonicals, forbidden in
 *   every chunk on disk, free-play chunks explicitly included: the answer
 *   pool has no legitimate client home anywhere.
 * - `FORBIDDEN_DAILY_SCOPE` — the motif/content markers, forbidden in
 *   daily-scope and unattributed chunks. Exactly as forbidden as before
 *   #28 for every daily route; ADR-0033's wire guarantees are untouched.
 * - `FORBIDDEN_FREE_PLAY_SCOPE` — `zurro`, the validation-dictionary
 *   control, forbidden in every `/modo-livre*` route's FIRST-LOAD SET,
 *   scanned per route and shared chunks included — NOT over the derived
 *   free-only set: if free play imported `@miolos/games/termo`, webpack
 *   could hoist the dictionary into a chunk shared with `/termo`, the
 *   derived set would exclude it by construction, and the scan would pass
 *   without ever looking. In `/termo`'s own first-load set it remains
 *   EXPECTED.
 */
const FORBIDDEN_EVERYWHERE = ["então", "mamãe", "época"];

/**
 * `requiredTier` IS DELIBERATELY NOT HERE, and it was until #28 (plan 025
 * §15 deviation, measured at step 5). The string also lives in
 * `packages/games/src/binairo/solve.ts` — `gradeBinairo` returns
 * `{ requiredTier }` — and solve.ts is a module the DAILY legitimately
 * ships (`solveBinairo` is the hint's solution memo). While nothing in the
 * app used `gradeBinairo` the minifier dropped it and the marker was a
 * clean discriminator; free play made it a live export
 * (`generateBinairo` → `validateBinairo` → `gradeBinairo`), and webpack's
 * used-exports analysis is GLOBAL, so every chunk that carries solve.ts —
 * the daily `/binairo` first-load included — now retains the property key
 * with zero daily imports of the generator. A marker that fires on a
 * legitimate daily module cannot detect a leak. The generator-leak duty it
 * carried transfers whole to `givensCount` (binairo validate/generate —
 * modules the daily never imports), `clueCount` (sudoku generate) and the
 * motif names (nonogram); ADR-0047 records the exclusion.
 */
const FORBIDDEN_DAILY_SCOPE = [
  "Escada",
  "Borboleta",
  "Caranguejo",
  "Flamingo",
  "sitting-cat",
  "motifId",
  "reveal.solution must be size x size",
  "givensCount",
  "clueCount",
];

const FORBIDDEN_FREE_PLAY_SCOPE = ["zurro"];

/**
 * Strings that MUST appear, so a scan looking at nothing cannot pass.
 *
 * The first three are `apps/web/src/i18n/messages.ts` copy, and on their own
 * they prove only that the scan reaches `apps/web`'s own chunks. Every motif
 * negative above lives in `packages/games/src/nonogram/motifs-*.ts`, so the
 * LAST entry is the control that matters: it is `solveNonogram`'s typed
 * input-contract error (`packages/games/src/nonogram/solve.ts`), a
 * `packages/games` string that genuinely ships, and it is what keeps the five
 * motif negatives from going silently vacuous if workspace-package code were
 * ever chunked somewhere the `readdirSync`/`.js` walk below does not look.
 *
 * `zurro` IS THE CONTROL FOR THE TERMO NEGATIVES, and it is a tighter one
 * than any of the four above could be. It is a validation word — US-ASCII,
 * from the list `isValidGuess` MUST ship — so it lives in the very same
 * generated module as `então`, `mamãe` and `época` and reaches the same
 * chunk. Without it the three Termo negatives would pass on the day someone
 * stopped shipping the word list altogether, or on the day this walk stopped
 * reaching that chunk, while asserting the absence of nothing.
 */
const EXPECTED_DAILY_SCOPE = [
  "Preenchemos uma célula da figura para você.",
  "Revele a figura escondida pelos números.",
  "Nível",
  "malformed nonogram clues: size must be an integer in 1..",
  "zurro",
];

/**
 * The controls that keep the SPLIT itself honest (ADR-0047): the SAME
 * strings the daily scope forbids, required in the free-play-only chunks.
 * `Escada` forbidden-in-daily + expected-in-free means (a) the attribution
 * actually separates the two sets — mis-attributed free chunks red the
 * forbidden side, an empty or unscanned free set reds this side; (b) the
 * marker still exists in the library, additionally pinned by
 * `packages/games/test/nonogram/bundle-markers.test.ts`.
 */
const EXPECTED_FREE_PLAY_SCOPE = ["Escada", "givensCount"];

function fail(message) {
  console.error(`FAIL  ${message}`);
  process.exitCode = 1;
}

function readStats() {
  try {
    return JSON.parse(readFileSync(STATS, "utf8"));
  } catch {
    console.error(
      `Could not read ${STATS}. Run \`pnpm build\` in apps/web first ` +
        "(the file is emitted by every `next build`).",
    );
    process.exit(2);
  }
}

function sizesOf(chunkPaths) {
  let raw = 0;
  let gzip = 0;
  for (const path of chunkPaths) {
    raw += statSync(path).size;
    gzip += gzipSync(readFileSync(path)).length;
  }
  return { raw, gzip };
}

const kb = (bytes) => (bytes / 1024).toFixed(1).padStart(8);
const signedKb = (bytes) =>
  `${bytes < 0 ? "-" : "+"}${(Math.abs(bytes) / 1024).toFixed(1)}`.padStart(8);

const stats = readStats();
const measured = stats.map((entry) => ({
  route: entry.route,
  ...sizesOf(entry.firstLoadChunkPaths),
}));

const home = measured.find((entry) => entry.route === "/");
if (home === undefined) {
  console.error("No `/` route in the stats — nothing to take a delta against.");
  process.exit(2);
}

console.log("First Load JS per route (Next's own figure, deltas over `/`)\n");
console.log("route                    raw KB   Δ raw KB   gzip KB  Δ gzip KB");
for (const entry of measured.sort((a, b) => a.route.localeCompare(b.route))) {
  const isHome = entry.route === "/";
  console.log(
    entry.route.padEnd(22) +
      kb(entry.raw) +
      (isHome ? "         —" : signedKb(entry.raw - home.raw).padStart(11)) +
      kb(entry.gzip) +
      (isHome ? "         —" : signedKb(entry.gzip - home.gzip).padStart(11)),
  );
}

console.log("");
for (const route of BUDGETED) {
  const entry = measured.find((current) => current.route === route);
  if (entry === undefined) {
    fail(`${route} is missing from the build — the budget cannot be checked.`);
    continue;
  }
  const delta = entry.raw - home.raw;
  const budget = budgetFor(route);
  if (delta > budget) {
    fail(
      `${route} adds ${(delta / 1024).toFixed(1)} KB over \`/\`, over the ` +
        `${budget / 1024} KB budget.`,
    );
  } else {
    console.log(
      `ok    ${route} adds ${(delta / 1024).toFixed(1)} KB over \`/\` ` +
        `(budget ${budget / 1024} KB)`,
    );
  }
}

/* ── chunk attribution (ADR-0047) ─────────────────────────────────────── */

// Structural sanity FIRST: a missing free-play route would silently shrink
// the free-play scope, and a vacuous scope is a failure, never a pass.
for (const route of FREE_PLAY_ROUTES) {
  if (!stats.some((entry) => entry.route === route)) {
    console.error(
      `\`${route}\` is missing from ${STATS} — the free-play scope would ` +
        "be scanned vacuously. Exiting 2.",
    );
    process.exit(2);
  }
}

const isFreePlayRoute = (route) =>
  route === FREE_PLAY_PREFIX || route.startsWith(`${FREE_PLAY_PREFIX}/`);

// Attribution runs on NORMALIZED paths (the stats file and the disk walk
// spell the same chunk differently).
const normalize = (path) => join(path);

const dailyChunkSet = new Set(
  stats
    .filter((entry) => !isFreePlayRoute(entry.route))
    .flatMap((entry) => entry.firstLoadChunkPaths.map(normalize)),
);

const freeOnlyChunkSet = new Set(
  stats
    .filter((entry) => isFreePlayRoute(entry.route))
    .flatMap((entry) => entry.firstLoadChunkPaths.map(normalize))
    // A chunk shared with ANY daily route is daily scope, period: sharing
    // withheld-content code with a daily route is the defect, not an
    // attribution nuance (ADR-0047).
    .filter((path) => !dailyChunkSet.has(path)),
);

if (freeOnlyChunkSet.size === 0) {
  console.error(
    "The free-play-only chunk set is empty — the free-play expected " +
      "markers would be scanned vacuously. Exiting 2.",
  );
  process.exit(2);
}

const allChunkPaths = readdirSync(CHUNKS, { recursive: true })
  .map((name) => join(CHUNKS, name))
  .filter((path) => path.endsWith(".js") && statSync(path).isFile())
  .map(normalize);

// Everything on disk in neither set — lazy chunks, runtime slices — scans
// as DAILY scope: fail closed (ADR-0047).
const unattributedChunkPaths = allChunkPaths.filter(
  (path) => !dailyChunkSet.has(path) && !freeOnlyChunkSet.has(path),
);

const readAll = (paths) => paths.map((path) => readFileSync(path, "utf8"));

const everySource = readAll(allChunkPaths);
const dailyScopeSources = readAll([
  ...dailyChunkSet,
  ...unattributedChunkPaths,
]);
const freeOnlySources = readAll([...freeOnlyChunkSet]);

console.log("");
console.log(
  `chunk attribution: ${dailyChunkSet.size} daily-scope, ` +
    `${freeOnlyChunkSet.size} free-play-only, ` +
    `${unattributedChunkPaths.length} unattributed (scanned as daily)`,
);

console.log("");
for (const marker of FORBIDDEN_EVERYWHERE) {
  const hits = everySource.filter((source) => source.includes(marker)).length;
  if (hits > 0) {
    fail(
      `\`${marker}\` appears in ${hits} client chunk(s); it must appear in 0 ` +
        "anywhere (Termo answer canonical).",
    );
  } else {
    console.log(`ok    \`${marker}\` absent from every client chunk`);
  }
}

for (const marker of FORBIDDEN_DAILY_SCOPE) {
  const hits = dailyScopeSources.filter((source) =>
    source.includes(marker),
  ).length;
  if (hits > 0) {
    fail(
      `\`${marker}\` appears in ${hits} daily-scope/unattributed chunk(s); ` +
        "it must appear in 0 (ADR-0033 as amended by ADR-0047).",
    );
  } else {
    console.log(`ok    \`${marker}\` absent from every daily-scope chunk`);
  }
}

// Per free-play ROUTE, first-load set directly — never the derived
// free-only set, which hoisting could empty (ADR-0047).
for (const marker of FORBIDDEN_FREE_PLAY_SCOPE) {
  for (const route of FREE_PLAY_ROUTES) {
    const entry = stats.find((current) => current.route === route);
    const routeSources = readAll(entry.firstLoadChunkPaths.map(normalize));
    const hits = routeSources.filter((source) =>
      source.includes(marker),
    ).length;
    if (hits > 0) {
      fail(
        `\`${marker}\` appears in ${hits} chunk(s) of ${route}'s first-load ` +
          "set; the Termo dictionary leaked into free play.",
      );
    } else {
      console.log(`ok    \`${marker}\` absent from ${route}'s first-load set`);
    }
  }
}

for (const marker of EXPECTED_DAILY_SCOPE) {
  const hits = dailyScopeSources.filter((source) =>
    source.includes(marker),
  ).length;
  if (hits === 0) {
    fail(
      `\`${marker}\` appears in 0 daily-scope chunks — the scan is looking ` +
        "at the wrong files, so its negatives prove nothing.",
    );
  } else {
    console.log(`ok    \`${marker}\` present in ${hits} daily-scope chunk(s)`);
  }
}

for (const marker of EXPECTED_FREE_PLAY_SCOPE) {
  const hits = freeOnlySources.filter((source) =>
    source.includes(marker),
  ).length;
  if (hits === 0) {
    fail(
      `\`${marker}\` appears in 0 free-play-only chunks — either the ` +
        "attribution collapsed or the scan stopped looking, and the daily " +
        "forbidden side above is only meaningful while this side finds it.",
    );
  } else {
    console.log(
      `ok    \`${marker}\` present in ${hits} free-play-only chunk(s)`,
    );
  }
}
