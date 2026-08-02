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
 * budget, which all three routes are half of. Measured across #25 the two
 * shipped deltas moved 28.6 → 30.9 KB and 26.4 → 28.2 KB and the run printed
 * `ok` for both, which is correct behaviour and NOT a control firing. A real
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
 * and its `FORBIDDEN`/`EXPECTED` arrays hard-code pt-BR product copy, which as
 * an unconditional CI step would red a build for a copy edit. Run it at step 8
 * and paste the output in the PR; a reviewer reading ADR-0027 or ADR-0033
 * should read them the same way.
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
const BUDGETED = ["/binairo", "/nonogram", "/sudoku"];

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
 */
const FORBIDDEN = [
  "Escada",
  "Borboleta",
  "Caranguejo",
  "Flamingo",
  "sitting-cat",
  "motifId",
  "reveal.solution must be size x size",
  "givensCount",
  "requiredTier",
  "clueCount",
];

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
 */
const EXPECTED = [
  "Preenchemos uma célula da figura para você.",
  "Revele a figura escondida pelos números.",
  "Nível",
  "malformed nonogram clues: size must be an integer in 1..",
];

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
  if (delta > MAX_DELTA_BYTES) {
    fail(
      `${route} adds ${(delta / 1024).toFixed(1)} KB over \`/\`, over the ` +
        `${MAX_DELTA_BYTES / 1024} KB budget.`,
    );
  } else {
    console.log(
      `ok    ${route} adds ${(delta / 1024).toFixed(1)} KB over \`/\` ` +
        `(budget ${MAX_DELTA_BYTES / 1024} KB)`,
    );
  }
}

const sources = readdirSync(CHUNKS, { recursive: true })
  .map((name) => join(CHUNKS, name))
  .filter((path) => path.endsWith(".js") && statSync(path).isFile())
  .map((path) => readFileSync(path, "utf8"));

console.log("");
for (const marker of FORBIDDEN) {
  const hits = sources.filter((source) => source.includes(marker)).length;
  if (hits > 0) {
    fail(
      `\`${marker}\` appears in ${hits} client chunk(s); it must appear in 0.`,
    );
  } else {
    console.log(`ok    \`${marker}\` absent from every client chunk`);
  }
}

for (const marker of EXPECTED) {
  const hits = sources.filter((source) => source.includes(marker)).length;
  if (hits === 0) {
    fail(
      `\`${marker}\` appears in 0 client chunks — the scan is looking at the ` +
        "wrong files, so its negatives prove nothing.",
    );
  } else {
    console.log(`ok    \`${marker}\` present in ${hits} client chunk(s)`);
  }
}
