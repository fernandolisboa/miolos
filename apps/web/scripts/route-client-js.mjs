#!/usr/bin/env node

import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const NEXT_DIR = ".next";
const STATS = join(NEXT_DIR, "diagnostics", "route-bundle-stats.json");
const CHUNKS = join(NEXT_DIR, "static", "chunks");

const MAX_DELTA_BYTES = 40 * 1024;

const PER_ROUTE_BUDGET = {
  "/termo": 76 * 1024,

  "/modo-livre/nonogram": 60 * 1024,

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

  "/estatisticas",

  //

  //

  //

  "/arquivo",
  "/arquivo/mes/[mes]",
  "/arquivo/[data]",
  "/arquivo/[data]/binairo",
  "/arquivo/[data]/nonogram",
  "/arquivo/[data]/sudoku",
  "/arquivo/[data]/termo",

  //

  "/binairo/concluido",
  "/nonogram/concluido",
  "/sudoku/concluido",
  "/termo/concluido",
];

const FREE_PLAY_PREFIX = "/modo-livre";

const FREE_PLAY_ROUTES = [
  "/modo-livre",
  "/modo-livre/binairo",
  "/modo-livre/nonogram",
  "/modo-livre/sudoku",
];

const budgetFor = (route) => PER_ROUTE_BUDGET[route] ?? MAX_DELTA_BYTES;

const FORBIDDEN_EVERYWHERE = ["então", "mamãe", "época"];

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

const EXPECTED_DAILY_SCOPE = [
  "Preenchemos uma célula da figura para você.",
  "Revele a figura escondida pelos números.",
  "Nível",
  "malformed nonogram clues: size must be an integer in 1..",
  "zurro",
];

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
