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
 * and that is what the ≤ 40 KB acceptance in §20.2 bounds. The two shipped
 * play routes are the regression controls: if binairo's and sudoku's deltas
 * move in a nonogram PR, something shared moved.
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
 * Usage, from `apps/web`, after a build:
 *
 *     pnpm build && node scripts/route-client-js.mjs
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

/** Strings that MUST appear, so a scan looking at nothing cannot pass. */
const EXPECTED = [
  "Preenchemos uma célula da figura para você.",
  "Revele a figura escondida pelos números.",
  "Nível",
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
