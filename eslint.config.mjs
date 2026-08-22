// Root flat config — the only ESLint config in the repo (`pnpm lint` runs once at the root).
import { builtinModules } from "node:module";

import js from "@eslint/js";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

const appGlobs = ["apps/web/**/*.{ts,tsx}", "apps/api/**/*.{ts,tsx}"];

// Every extension the apps/web db wall covers. `.mts`/`.cts` were added when a
// `.mts` file slipping a `.ts`-only glob turned out to be a proven evasion
// vector (PR #48 step 6); the plain-JS extensions close the identical hole
// (step 6 finding web-db-wall-glob-misses-js-jsx-mjs). apps/web/tsconfig.json
// sets `allowJs` with `checkJs` off and next.config.ts overrides no
// `pageExtensions`, so `apps/web/app/<route>/page.jsx` is a real route that
// typechecks — it must not be able to import the solution-bearing reader.
const webWallExtensions = "{ts,tsx,mts,cts,js,jsx,mjs,cjs}";

// Part of the apps/web db wall (ADR-0024 §5). Named because they have to appear
// in BOTH wall config objects below — see the comment at their second use.
const webDynamicDbImport = {
  // no-restricted-imports cannot see dynamic specifiers.
  selector:
    "ImportExpression > Literal[value=/^@miolos\\/db\\/(publishing|user|testing)(\\/|$)/]",
  message:
    "apps/web is client-serving: dynamic import of the server-internal @miolos/db subpaths is banned (ADR-0024, ADR-0026).",
};

// The dynamic-import half of the deep-path bans in the `patterns` arrays
// below. `no-restricted-imports` cannot see a dynamic specifier at all, so
// `await import("../../../packages/core/src/contracts/daily-content")` walked
// through the static path ban the same way the bare-specifier ban was walked
// through by a relative path (step-6 round-4 finding
// `core-server-only-ban-is-bare-specifier-only`). Both package sources, since
// both are banned by path: `packages/db/src` hands out every server-internal
// table, `packages/core/src` reaches the server-only daily-content schemas
// whose module is retained in every route's browser chunk once named.
//
// It does NOT cover `(await import("@miolos/core")).stripDailyContent`: a
// dynamic import names no exports at the AST level, and the bare entry is
// legitimately importable for its client half. That form is left to the
// bundle tripwire, deliberately, rather than banning the entry outright.
const webDynamicPackageSource = {
  selector:
    "ImportExpression > Literal[value=/packages\\/(db|core)\\/src(\\/|$)/]",
  message:
    "apps/web is client-serving: dynamic import of a relative path into packages/db/src or packages/core/src is banned — it evades the deep-path import restrictions (ADR-0024, ADR-0026, ADR-0033).",
};

// Companion to webDynamicDbImport, which only sees a plain string specifier:
// import(`@miolos/db/publishing`) and import("@miolos/db/" + "publishing")
// walked straight through it (step 6 finding
// dynamic-import-selector-misses-computed-specifiers). Matching on `source`
// rather than on any non-Literal child is deliberate — ImportExpression also
// carries the options argument, so `> :not(Literal)` would false-positive on
// import("./x.json", { with: { type: "json" } }).
const webComputedDynamicImport = {
  selector: 'ImportExpression[source.type!="Literal"]',
  message:
    "apps/web is client-serving: a computed dynamic import() specifier is banned — it evades the @miolos/db import restrictions (ADR-0024, ADR-0026).",
};

// no-restricted-imports does not see require() either, so covering `.cjs` above
// would otherwise leave CommonJS as an open door. apps/web is `"type": "module"`
// and has no require() call in source, so ban the call outright — the same
// closure packages/games already uses below.
const webRequireCall = {
  selector: "CallExpression[callee.name='require']",
  message:
    "apps/web is client-serving ESM: require() is banned — it evades the @miolos/db import restrictions (ADR-0024, ADR-0026).",
};

// THE NO-SESSION-REPLAY WALL (#33, ADR-0069 decision 1; step-6 issue B1).
// CLAUDE.md lists "No session replay in telemetry" as a VETO, and issue #33's
// AC says "disabled AND STAYS DISABLED" — "stays" is the whole claim, and
// until this group existed the protection was a convention (we chose not to
// install an SDK) plus a copy assertion. This is the same argument the
// free-play wall below makes about structural silence: a claim that rests on
// nobody having added the import survives exactly until someone does.
//
// Named packages, not a heuristic: `posthog-js` and `posthog-js-lite` are the
// two clients ADR-0069 decision 1 rejected by name, and `rrweb` is the
// recorder every browser session-replay implementation is built on — banning
// it closes the "roll our own replay" door as well as the SDK one.
//
// THIS IS THE SOURCE HALF ONLY, deliberately. `no-restricted-imports` cannot
// see `await import("posthog-js")` and does not run on `package.json` at all.
// The INSTALL half — which is upstream of every import shape, dynamic and
// `require()` included — is `apps/web/test/no-session-replay.test.ts`
// (T-WEB-S322), a manifest and lockfile scan. Neither half is sufficient
// alone; together a replay-capable client cannot arrive in silence.
const replayCapableClientGroups = [
  {
    group: [
      "posthog-js",
      "posthog-js/*",
      "posthog-js-lite",
      "posthog-js-lite/*",
      "@posthog/*",
      "rrweb",
      "rrweb/*",
      "@rrweb/*",
    ],
    message:
      "no session replay, and no client PostHog SDK: telemetry is five server-anchored events over a hand-rolled capture in apps/api, so the ceiling and the published no-replay promise hold by construction (CLAUDE.md invariants, ADR-0069 decision 1, /privacidade's own copy).",
  },
];

// The app-wide import wall's two halves (wall object (1) below), extracted to
// named constants for the SAME reason `webDynamicDbImport` was: flat config
// REPLACES a rule's whole configuration per matching file — it never merges —
// so the free-play object further down has to REPEAT these verbatim or it
// would silently delete the db wall for exactly the free-play files
// (T-LINT-S14/S15 pin the repetition). #34 gave them a SECOND repeater, the
// OG wall (object (4)), on the same rule, and T-LINT-S43 is that object's own
// regression control.
//
// THE RULE IS NOT "A SUBSET OF (1) OR (2)" — IT IS ANY INTERSECTION WITH ANY
// EARLIER OBJECT, and this clause was written one wall too narrow at #34
// (step-6 finding K1). Object (4)'s globs also intersect object (3)'s: a
// future `app/modo-livre/**/opengraph-image.tsx` matches both, later wins,
// and free play's own bans — stricter than the app-wide wall's, since they
// forbid `@miolos/db`'s root entry outright — would vanish with no file diff
// to see it in. Object (5) is that intersection, repeating BOTH. Consumed
// unchanged by object (1): this extraction is a pure move, and the
// eslint-db-wall.test.ts probes are the no-op proof.
const webWallImportPatterns = [
  {
    group: [
      "@miolos/db/publishing",
      "@miolos/db/publishing/*",
      "@miolos/db/user",
      "@miolos/db/user/*",
      "@miolos/db/testing",
      "@miolos/db/testing/*",
    ],
    message:
      "apps/web is client-serving: import the wall-safe root entry `@miolos/db` only. `/publishing` carries the raw tables, the buffer writers and the solution-bearing reader; `/user` carries the completion and hint-grant writers, which belong to apps/api; `/testing` hands out a full-schema client (ADR-0024, ADR-0026).",
  },
  {
    // Banning the bare specifiers is not enough on its own: a
    // relative path into the package source reaches `completions`,
    // `hint_grants`, `daily_puzzles` and `remote_config` with no rule
    // firing, falsifying plan 017 D17's "apps/web cannot even *name*
    // completions or hint_grants" (step 6 finding
    // web-db-wall-has-no-relative-path-ban).
    group: [
      "**/packages/db/src",
      "**/packages/db/src/*",
      "**/packages/db/src/**",
    ],
    message:
      "apps/web is client-serving: reach the db through the `@miolos/db` package entry, never by relative path into packages/db/src — the deep path hands out every server-internal table (ADR-0024, ADR-0026).",
  },
  {
    // The same lesson the `@miolos/db` group above learned one
    // ticket earlier, applied to the server-only core contracts: the
    // `paths` entry below fires on the BARE specifier only, so
    // `import { stripDailyContent } from
    // "../../../packages/core/src/contracts/daily-content"` linted,
    // typechecked and tested clean while re-shipping
    // `nonogramRevealSchema`'s `motifId` / `name` / `mirrored` /
    // `solution` key strings into every route's browser chunk —
    // exactly what commit d5bb543 and ADR-0033 exist to prevent
    // (step-6 round-4 finding
    // `core-server-only-ban-is-bare-specifier-only`). The whole
    // package source is banned by path rather than just the one
    // module: apps/web has the `@miolos/core` entry and never needs
    // a relative reach into it, and a path ban that enumerates
    // modules has to be re-checked on every new file.
    group: [
      "**/packages/core/src",
      "**/packages/core/src/*",
      "**/packages/core/src/**",
    ],
    message:
      "apps/web is client-serving: reach the contracts through the `@miolos/core` package entry, never by relative path into packages/core/src — the deep path reaches the SERVER-ONLY daily-content schemas, whose module is retained in the browser chunk of every route the moment anything names it (commit d5bb543, ADR-0024/ADR-0033).",
  },
  // Carried by THIS array, not by an object of its own, so that apps/web's
  // four repeaters — the app-wide wall (1), free play (3), the OG cards (4)
  // and their intersection (5) — all inherit it with no fifth place to
  // forget. apps/api and packages/** get it from their own object below;
  // apps/web is the only tree where a browser SDK could actually run.
  ...replayCapableClientGroups,
];

const webWallImportPaths = [
  {
    name: "@miolos/db",
    // `users` and `sessions` are on the root entry too, and
    // `db.select().from(users)` needs neither `sql` nor `eq` — an RSC
    // payload of every user row (or every session token hash) was one
    // import away (step 6 finding
    // root-entry-users-and-sessions-are-importable-from-apps-web).
    importNames: ["sql", "eq", "users", "sessions"],
    message:
      "apps/web must not build queries or touch the identity tables: read the daily through `getTodayDaily`. Raw SQL via the re-exported `sql` bypasses the published-predicate wall (ADR-0024 amendment), and every `users`/`sessions` read belongs to apps/api (ADR-0007/0014).",
  },
  {
    name: "@miolos/core",
    // The SERVER-ONLY half of the daily contracts
    // (packages/core/src/contracts/daily-content.ts). Commit d5bb543
    // split them out because a module-scope `z.strictObject(...)` is
    // a call the bundler cannot prove pure, so naming one of them
    // from apps/web retains the whole module — `nonogramRevealSchema`'s
    // `motifId` / `name` / `mirrored` / `solution` key strings
    // included — in the browser chunk of every route. `"sideEffects":
    // false` only drops the module while NOTHING here names it, and
    // until now that rule was prose in two file headers and a
    // hand-run grep (step-6 round-3 finding
    // `core-client-server-split-is-prose-only`). Pinned by T-LINT-3d.
    //
    // `termoDailyContentSchema` joined at #27. The list is not
    // maintained by hand for long: `T-LINT-S7` derives the expected
    // set from `daily-content.ts`'s own `export const|class|function`
    // identifiers and asserts SET EQUALITY, so a schema added there
    // and forgotten here is a red test rather than a silent hole —
    // and a name left here after the module stops exporting it is
    // red too, because a ban that covers nothing reads as coverage.
    // `contracts/termo-guess.ts`'s exports are deliberately NOT here:
    // they are client-safe by design and apps/web imports them.
    importNames: [
      "binairoDailyContentSchema",
      "DailyProjectionUnsupportedError",
      "nonogramDailyContentSchema",
      "stripDailyContent",
      "sudokuDailyContentSchema",
      "termoDailyContentSchema",
    ],
    message:
      "these are the SERVER-ONLY daily-content schemas (packages/core/src/contracts/daily-content.ts). apps/web receives the wall's already-stripped projection and must never name the content shape: one value import re-ships the withheld object's shape in every route's client chunk (commit d5bb543, ADR-0024/ADR-0033).",
  },
];

// Wall object (2)'s two table-name selectors, extracted for the identical
// flat-config reason: the free-play object matches files object (2) also
// matches, so it must repeat them or reopen the raw-SQL residual for exactly
// the free-play directories (T-LINT-S15).
const webTableNameLiteral = {
  selector: "Literal[value=/\\b(daily_puzzles|remote_config)\\b/]",
  message:
    "apps/web must not name the buffer tables: raw SQL through @miolos/db's re-exported `sql` / `.execute()` bypasses the published-predicate wall (ADR-0024 amendment, named #18 duty).",
};

const webTableNameTemplate = {
  // Not optional: without it, sql`select * from daily_puzzles` slips
  // straight through the Literal selector.
  selector: "TemplateElement[value.raw=/\\b(daily_puzzles|remote_config)\\b/]",
  message:
    "apps/web must not name the buffer tables: raw SQL through @miolos/db's re-exported `sql` / `.execute()` bypasses the published-predicate wall (ADR-0024 amendment, named #18 duty).",
};

// (3) THE FREE-PLAY WALL (#28, ADR-0046; plan 025 §9.1). Free play records
// nothing (ADR-0008 rule 5) and fetches nothing (ADR-0011), and this is the
// mechanical half of that claim: the modules that can reach the network, the
// play records or the db are import errors inside the free-play directories.
// `no-restricted-imports` is NOT transitive, so the daily hooks, the daily
// screen roots and `conclusion-view` — each one hop from `sync.ts` /
// `use-play-lifecycle` / `day-state` — are banned BY NAME alongside the
// direct doors. Both specifier shapes are listed: the `**/x` form for
// relative reaches, and the mount point `components/session-bootstrap`
// separately, because the bare `**/session/bootstrap` pattern does not match
// it.
const freePlayBannedModuleGroups = [
  {
    group: [
      "**/play/sync",
      "**/play/play-record",
      "**/play/use-play-lifecycle",
      "**/play/day-state",
      "**/play/use-record-snapshot",
      "**/play/conclusion-view",
      // #145 step 7b: the lazy boundary RE-EXPORTS `conclusion-view`'s two
      // views, so it is one hop from everything the entry above bans —
      // `useDayState` (GET /streak AND GET /day), the record snapshot, the
      // share pair, the push card. `no-restricted-imports` is NOT
      // transitive — the whole reason this list names one-hop doors by
      // hand (#103's share-button lesson, verbatim) — so the wrapper file
      // needs its own entry. Measured CLEAN from a free-play probe before
      // this entry existed (the step-7b review's lintText probes).
      "**/play/conclusion-lazy",
      // #34: the share text composes a `PlayRecord` into the string the
      // conclusion hands to the share sheet. Free play records nothing
      // (ADR-0008 rule 5, ADR-0046 `:31`), so it has nothing to share, and
      // ADR-0011's shareable-seed idea is noted rather than scheduled.
      "**/play/share-text",
      // #103: the BUTTON. #34's entry above used to close with "the BUTTON
      // needs no entry of its own: it lives inside `play/conclusion-view`,
      // which is already banned by name above", and that premise died the
      // moment the archive's late-result panel needed the same control and
      // the component moved to its own file. `no-restricted-imports` is NOT
      // transitive — the whole reason this list names one-hop doors by hand
      // — so without this entry `src/play/share-button` is an unnamed door
      // from free play to BOTH `play/share-text` and `play/play-record`.
      // Measured red on a probe before the entry existed.
      "**/play/share-button",
      "**/termo/guess-client",
      "**/session/bootstrap",
      "**/components/session-bootstrap",
      "**/binairo/use-binairo-play",
      "**/sudoku/use-sudoku-play",
      "**/nonogram/use-nonogram-play",
      "**/binairo/binairo-screen",
      "**/sudoku/sudoku-screen",
      "**/nonogram/nonogram-screen",
      // #145 step 7b, beside the screen roots they belong to: the two
      // per-game conclusion wrappers statically import `conclusion-view`,
      // so each is a one-hop door of the same class. They pre-dated this
      // pass (both shipped at their games' conclusion tickets) and linted
      // CLEAN from free play until these names entered the list — recorded
      // by the step-7b review as the same hole as `conclusion-lazy`'s,
      // closed in the same pass because it is the same list and the same
      // claim.
      "**/nonogram/nonogram-conclusion",
      "**/termo/termo-conclusion",
      // The hub page and its day-state island are one-hop doors of the
      // same class: `app/page` imports `hub-day-state` and `hub-streak`,
      // and `hub-day-state` reaches `play/day-state` — a relative
      // `../../app/page` from free play carried all of it with zero wall
      // hits until these names entered the list (#19 step-6 ADR M1, the
      // one-hop-by-name discipline this group exists for).
      "**/app/page",
      "**/app/hub-day-state",
    ],
    message:
      "free play records nothing and fetches nothing: the sync/record/lifecycle/session modules — and the daily hooks, screen roots, hub page and hub islands that reach them one hop in — are banned from apps/web/src/free-play and app/modo-livre (ADR-0011, ADR-0008 rule 5, ADR-0046).",
  },
  {
    // ALL of db, root entry included — stricter than the app-wide wall,
    // which permits the wall-safe root entry: free play reads no wall and
    // has no legitimate db surface at all.
    group: ["@miolos/db", "@miolos/db/*"],
    message:
      "free play is generated on the client and reads no database at all — not even the wall-safe root entry (ADR-0011, ADR-0046).",
  },
  {
    group: [
      "@miolos/games/termo",
      "@miolos/games/termo/*",
      "**/packages/games/src/termo",
      "**/packages/games/src/termo/**",
    ],
    message:
      "Termo is excluded from free play by project invariant: its word list is finite curated content and free play would burn it (ADR-0005, ADR-0015, ADR-0046).",
  },
  {
    // Both shapes on purpose (the `@miolos/db` + `@miolos/db/*` discipline
    // above): `**/streak/**` does not match a bare `../streak` specifier, so
    // without `**/streak` a future `src/streak/index.ts` barrel would walk
    // through this group. `**/hub-streak` closes the app-dir island, which
    // is importable by relative path even though nothing should.
    group: ["**/streak", "**/streak/**", "**/hub-streak"],
    message:
      "free play never touches the streak: the streak client, hook and hub island are banned from apps/web/src/free-play and app/modo-livre (ADR-0008 rule 5, ADR-0046, ADR-0048).",
  },
  {
    // #21: the attach modules reach identity, the streak read and the hub
    // page one hop in — banned by name like the streak group above (the
    // napkin's one-hop rule: any module newly one hop from a walled value
    // enters both the static group and the dynamic regex, with probes).
    // Both specifier shapes on purpose: `**/attach/**` does not match a
    // bare `../attach`, and `**/hub-attach` closes the app-dir island.
    group: ["**/attach", "**/attach/**", "**/hub-attach"],
    message:
      "free play never touches identity or the attach flow: the attach client, hook and hub island are banned from apps/web/src/free-play and app/modo-livre (ADR-0011, ADR-0046, ADR-0050).",
  },
  {
    // #35: the onboarding modules reach identity (the session mint via
    // `ensureSession`) and the hub page one hop in — banned by name like
    // the attach group above (the napkin's one-hop rule: any module newly
    // one hop from a walled value enters both the static group and the
    // dynamic regex, with probes). Both specifier shapes on purpose:
    // `**/onboarding/**` does not match a bare `../onboarding`, and
    // `**/hub-onboarding` closes the app-dir island.
    group: ["**/onboarding", "**/onboarding/**", "**/hub-onboarding"],
    message:
      "free play never touches identity or the first-visit introduction: the onboarding client, hook and hub island are banned from apps/web/src/free-play and app/modo-livre (ADR-0011, ADR-0046, ADR-0061).",
  },
  {
    // #29: the stats client and hooks reach the network and server-derived
    // aggregates, and the /estatisticas screen root reaches them one hop in
    // — banned by name like the streak group above (the napkin's one-hop
    // rule). Both specifier shapes on purpose: `**/stats/**` does not match
    // a bare `../stats`, so a future `src/stats/index.ts` barrel must not
    // become a door, and `**/app/estatisticas/**` closes the screen root.
    group: ["**/stats", "**/stats/**", "**/app/estatisticas/**"],
    message:
      "free play never touches the statistics: the stats client, hooks and the /estatisticas screen are banned from apps/web/src/free-play and app/modo-livre (ADR-0008 rule 5, ADR-0046, ADR-0051).",
  },
  {
    // #31: the archive's screens are one hop from `sync.ts`,
    // `play-record.ts`, `use-play-lifecycle.ts` and `use-record-snapshot.ts`
    // — the exact modules this wall exists to keep away from free play — and
    // `app/arquivo/**` is one hop from that. Banned by name like the stats
    // group above (the napkin's one-hop rule). Both specifier shapes on
    // purpose: `**/archive/**` does not match a bare `../archive`, so a
    // future `src/archive/index.ts` barrel must not become a door, and
    // `**/app/arquivo/**` closes the route segment.
    group: ["**/archive", "**/archive/**", "**/app/arquivo/**"],
    message:
      "free play records nothing and reads no archive: the archive's screens, its late-result panel and the /arquivo routes are banned from apps/web/src/free-play and app/modo-livre (ADR-0008 rule 5, ADR-0046, ADR-0053).",
  },
  {
    // #30: the medals client and hook reach the network and the
    // server-derived earned set, one hop from walled server values —
    // banned by name like the stats group above (the napkin's one-hop
    // rule). Both specifier shapes on purpose: `**/medals/**` does not
    // match a bare `../medals`, so a future `src/medals/index.ts` barrel
    // must not become a door. The section component lives inside
    // `app/estatisticas/stats-view.tsx`, which the stats group's
    // `**/app/estatisticas/**` already closes.
    group: ["**/medals", "**/medals/**"],
    message:
      "free play never touches the medals: the medals client and hook are banned from apps/web/src/free-play and app/modo-livre (ADR-0008 rule 5, ADR-0046, ADR-0052).",
  },
  {
    // #145 (ADR-0064): the push modules reach identity (the session mint
    // via `ensureSession`), the network and the streak-derived eligibility
    // — and the prompt card inside `play/` is one hop from them. Banned by
    // name like the onboarding group above (the napkin's one-hop rule).
    // The specifier shapes, all three on purpose: `**/push/**` does not
    // match a bare `../push`; `**/play/push-prompt-card` closes the card
    // itself — `no-restricted-imports` is NOT transitive, so the
    // conclusion-view ban above does not cover a direct reach into the
    // card. The glob is narrower than it looks (the `**/day` precedent,
    // T-LINT-S50's control): `**/push` and `**/push/**` match `../push`
    // and `../push/push-client` and match NEITHER `../play/push-prompt-card`
    // (its own literal name is the third entry) nor anything else shipped.
    group: ["**/push", "**/push/**", "**/play/push-prompt-card"],
    message:
      "free play never touches identity or the push opt-in: the push client, hook and prompt card are banned from apps/web/src/free-play and app/modo-livre (ADR-0011, ADR-0046, ADR-0064).",
  },
  {
    // #83 (ADR-0060): the day client and the day-truth store reach the
    // network and a server-derived, user-specific answer — banned by name
    // like the stats group above (the napkin's one-hop rule). Both specifier
    // shapes on purpose: `**/day/**` does not match a bare `../day`, so a
    // future `src/day/index.ts` barrel must not become a door.
    //
    // THE GLOB IS NARROWER THAN IT LOOKS, and that was checked rather than
    // assumed (T-LINT-S47): `**/day` and `**/day/**` match `../day` and
    // `../day/day-truth`, and match NEITHER `../play/day-state` NOR
    // `../../app/hub-day-state` — both of which are already banned by name
    // in the first group above, where they belong.
    group: ["**/day", "**/day/**"],
    message:
      "free play never touches the day: the day client and the day-truth store are banned from apps/web/src/free-play and app/modo-livre (ADR-0008 rule 5, ADR-0046, ADR-0060).",
  },
  {
    // #33 (ADR-0069): the telemetry relay client reaches the network and,
    // through the session cookie the request carries, a server-resolved
    // identity — banned by name like the day group above (the napkin's
    // one-hop rule). FREE PLAY FIRES NO EVENTS AT ALL (ADR-0069 decision
    // 4): it is already structurally silent, because free play never mounts
    // `usePlayLifecycle` and that hook is the only caller — but structural
    // silence is exactly the kind of claim that survives until someone adds
    // a second caller, so it is made mechanical here instead of assumed.
    //
    // Both specifier shapes on purpose: `**/telemetry/**` does not match a
    // bare `../telemetry`, so a future `src/telemetry/index.ts` barrel must
    // not become a door. The glob is narrower than it looks and was checked
    // rather than assumed (T-LINT-S52's own control): nothing else shipped
    // in apps/web is named `telemetry`.
    group: ["**/telemetry", "**/telemetry/**"],
    message:
      "free play fires no telemetry: the puzzle_started relay client is banned from apps/web/src/free-play and app/modo-livre (ADR-0008 rule 5, ADR-0046, ADR-0069).",
  },
];

// The dynamic-import evasion of the groups above: `no-restricted-imports`
// never sees `import("../play/sync")`. Computed specifiers are already
// banned app-wide by `webComputedDynamicImport`, which the free-play object
// repeats, so a literal-specifier regex is the whole residual.
const freePlayDynamicBannedModule = {
  selector:
    // `\\/day(\\/|$)` — the leading slash is load-bearing and was checked
    // rather than assumed (T-LINT-S48): it matches `../day` and
    // `../day/day-truth` and matches NEITHER `../play/day-state` NOR
    // `../../app/hub-day-state`, whose own literal names are already in this
    // alternation, where they belong.
    // `\\/telemetry(\\/|$)` follows the `\\/day` shape for the same reason
    // (#33, T-LINT-S52): the leading slash keeps it to `../telemetry` and
    // `../telemetry/client`.
    "ImportExpression > Literal[value=/(play\\/(sync|play-record|use-play-lifecycle|day-state|use-record-snapshot|conclusion-view|conclusion-lazy|share-text|share-button|push-prompt-card)|termo\\/(guess-client|termo-conclusion)|session\\/bootstrap|components\\/session-bootstrap|binairo\\/(use-binairo-play|binairo-screen)|sudoku\\/(use-sudoku-play|sudoku-screen)|nonogram\\/(use-nonogram-play|nonogram-screen|nonogram-conclusion)|streak(\\/|$)|hub-streak|attach(\\/|$)|hub-attach|onboarding(\\/|$)|hub-onboarding|\\/push(\\/|$)|stats(\\/|$)|medals(\\/|$)|\\/day(\\/|$)|\\/telemetry(\\/|$)|estatisticas|archive(\\/|$)|arquivo|app\\/page$|app\\/hub-day-state|^@miolos\\/db(\\/|$)|^@miolos\\/games\\/termo(\\/|$)|packages\\/games\\/src\\/termo)/]",
  message:
    "free play records nothing, fetches nothing, fires no telemetry, never touches Termo, the streak, the day, the statistics, the medals, the attach flow, the onboarding flow or the push opt-in: dynamic import of the banned modules is banned too (ADR-0011, ADR-0008 rule 5, ADR-0046, ADR-0048, ADR-0050, ADR-0051, ADR-0052, ADR-0060, ADR-0061, ADR-0064, ADR-0069).",
};

// (4) THE OG WALL's own ban (#34, ADR-0054 decisions 8 and 15). Everything
// else in that wall object is objects (1)'s and (2)'s arrays, repeated — see
// the object itself for why that repetition is not redundant.
const ogBannedGameGroups = [
  {
    // ADR-0033 decision 2 `:49-55` — the Nonogram picture is DERIVABLE from
    // the published clues in under a millisecond (Context `:26-30`: 280
    // dailies, 0 mismatches, worst 0.338 ms). Withholding it protects nothing
    // about the picture's shape, so refusing to DRAW it is a PRODUCT decision
    // and not a confidentiality one — the ADR requires it be stated in those
    // words wherever it is cited. This is the mechanical half of that
    // refusal: an OG route already holds `daily.clues` from its wall read, so
    // `solveNonogram` is one import away from painting the exact bitmap into
    // a chat bubble for people who have not played. Reachable today with
    // ZERO lint hits — `@miolos/games` is in `transpilePackages` and the
    // free-play wall bans only `@miolos/games/termo`, only under free play.
    group: [
      "@miolos/games",
      "@miolos/games/*",
      "**/packages/games/src",
      "**/packages/games/src/*",
      "**/packages/games/src/**",
    ],
    message:
      "an OG card draws no puzzle content: @miolos/games is banned from the card and the image routes — `solveNonogram(clues)` recovers the Nonogram picture from the published clues, and refusing to draw it is the product decision ADR-0033 decision 2 records (ADR-0054 decision 8).",
  },
];

const ogDynamicGamesImport = {
  selector:
    "ImportExpression > Literal[value=/(^@miolos\\/games(\\/|$)|packages\\/games\\/src)/]",
  message:
    'an OG card draws no puzzle content, dynamically either: `no-restricted-imports` never sees `import("@miolos/games/nonogram")`, and one dynamic import is all `solveNonogram` needs (ADR-0033 decision 2, ADR-0054 decision 8).',
};

// eslint-config-next ships a flat Linter.Config[]; scope every non-ignore
// entry to the two Next apps so its rules never leak into the packages.
// The scope must be FORCED, not defaulted (`config.files ?? appGlobs`
// does not work): its entries carry repo-wide globs like
// "**/*.{js,jsx,mjs,ts,tsx,mts,cts}", which would apply Next/React rules
// to the packages and crash eslint-plugin-react's version detection
// outside the apps. Re-verify this map on any eslint-config-next major.
const nextConfigs = nextCoreWebVitals.map((config) =>
  config.ignores && !config.rules && !config.plugins
    ? config
    : { ...config, files: appGlobs },
);

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/next-env.d.ts",
      "docs/**",
      "content/**",
      ".claude/**",
      "pnpm-lock.yaml",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          // The shared worker bound and the per-package configs that import it
          // (ADR-0057 decision 6) are deliberately NOT in any package's
          // tsconfig `include`. `packages/core` and `packages/ui` compile with
          // `types: []`, and pulling in a file that reaches `vitest/config`
          // would drag vite's `@types/node`-referencing declarations into those
          // programs — the exact contamination ADR-0017 forbids in
          // `packages/games`. Linting them through the default project keeps
          // them checked without touching a single tsconfig.
          // Listed one by one rather than globbed: `apps/web/vitest.config.ts`
          // predates this and IS in its tsconfig, and a glob that swept it in
          // is an error ("included by allowDefaultProject but also found in
          // the project service"), not a silent no-op.
          allowDefaultProject: [
            "vitest.shared.ts",
            "packages/db/vitest.config.ts",
            "packages/core/vitest.config.ts",
            "packages/ui/vitest.config.ts",
            "apps/api/vitest.config.ts",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
    },
  },
  ...nextConfigs,
  {
    files: appGlobs,
    settings: {
      next: {
        rootDir: ["apps/web", "apps/api"],
      },
      // Explicit version: eslint-plugin-react@7's auto-detection calls the
      // ESLint ≤9 API context.getFilename and crashes under ESLint 10.
      // Major only — a patch-precise pin would silently drift on react bumps.
      react: {
        version: "19",
      },
    },
  },
  {
    // Plain-JS extensions under the two Next apps. Without an entry that NAMES
    // them, `.jsx` is matched by no config object in the repo at all —
    // eslint-config-next's repo-wide globs are force-scoped to `{ts,tsx}` above
    // — so ESLint skips the file outright ("File ignored because no matching
    // configuration was supplied") and the db wall below never runs on it
    // (step 6 finding web-db-wall-glob-misses-js-jsx-mjs). JSX has to be
    // enabled explicitly here: espree would otherwise die at the first `<`,
    // which would report the wall as silent for the wrong reason.
    files: ["apps/web/**/*.{js,jsx,mjs,cjs}", "apps/api/**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },
  {
    // #145 (ADR-0064): the caching-free service worker — a plain unbundled
    // JS file served at /sw.js, matched by the plain-JS entry above but
    // parsed there with no worker globals. SCANNED WITH ITS OWN GLOBALS
    // rather than ignored — an ignored file is an unscanned file, and this
    // is the one file where a stray request-interception handler would be
    // an ADR-0004 breach (T-WEB-S261 pins the source; this entry keeps
    // `self`/`clients` from reading as undefined globals).
    files: ["apps/web/public/sw.js"],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
  {
    // (0) THE NO-SESSION-REPLAY WALL OUTSIDE apps/web (#33, ADR-0069
    // decision 1) — see the constant's header. apps/web carries it through
    // `webWallImportPatterns`; this object is the rest of the repo, so a
    // replay-capable client cannot arrive through apps/api or a package
    // either.
    //
    // PLACED BEFORE the games object below, on purpose. `packages/**`
    // intersects `packages/games/src/**`, and flat config REPLACES a rule's
    // whole configuration per matching file — so the later, stricter games
    // object becomes games source's entire `no-restricted-imports`, which is
    // correct: it already bans every non-relative specifier, this list
    // included. Placed AFTER it, this object would delete the purity
    // backstop.
    files: [
      "apps/api/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
      "packages/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: replayCapableClientGroups },
      ],
    },
  },
  {
    // Purity backstop for packages/games (ADR in CLAUDE.md invariants; primary
    // check is packages/games/test/purity.test.ts): games source may import
    // nothing but itself — no Node builtins, no React, no React Native.
    // `.mts`/`.cts` included: a `.mts` file slipping a `.ts`-only glob was a
    // proven evasion vector (step 6 review).
    files: ["packages/games/src/**/*.{ts,tsx,mts,cts}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "node:*",
                ...builtinModules,
                "react",
                "react-dom",
                "react-native",
              ],
              message:
                "packages/games is pure TypeScript: only relative imports of its own source are allowed.",
            },
          ],
        },
      ],
      // no-restricted-imports cannot see computed specifiers such as
      // import("node" + ":fs"). Games has no legitimate dynamic imports,
      // so ban the syntax outright.
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression",
          message:
            "packages/games is pure TypeScript: dynamic import() is banned (computed specifiers evade the import restriction).",
        },
        {
          selector: "CallExpression[callee.name='require']",
          message: "packages/games is pure TypeScript: require() is banned.",
        },
      ],
    },
  },
  {
    // (1) IMPORT BANS — all of apps/web, tests included. ADR-0024 §5 and its
    // 2026-07-31 amendment; a named #18 duty, live from the PR that gives
    // apps/web the @miolos/db dependency. apps/web is client-serving, so the
    // only db surface it may hold is the wall-safe root entry:
    //   - /publishing — raw tables, buffer writers, createPublishingDb,
    //     getPublishedDailyWithSolution;
    //   - /user — completions and hint grants; every write and every
    //     user-specific read belongs to apps/api (ADR-0007/0014);
    //   - /testing — createTestDb returns a FULL-schema drizzle client over
    //     daily_puzzles and pulls PGlite; apps/web runs no PGlite (plan 017
    //     D33), so it has no legitimate use for it either.
    // The extension list is shared and deliberately wide — see
    // `webWallExtensions`.
    files: [`apps/web/**/*.${webWallExtensions}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          // Both halves live in module-level constants since #28 (a pure
          // move, pinned no-op by the eslint-db-wall.test.ts probes): the
          // free-play wall object below has to repeat them, because flat
          // config REPLACES a rule's whole configuration when a later object
          // sets the same rule id — a second object that did not repeat them
          // would silently delete this wall for exactly the files it matches.
          // apps/web/test/** is inside this glob and imports none of these
          // names.
          patterns: webWallImportPatterns,
          paths: webWallImportPaths,
        },
      ],
      "no-restricted-syntax": [
        "error",
        webDynamicDbImport,
        webDynamicPackageSource,
        webComputedDynamicImport,
        webRequireCall,
      ],
    },
  },
  {
    // (2) TABLE-NAME LITERALS — apps/web SOURCE only, which is the ADR-0024
    // amendment's own wording. The residual it targets is raw SQL through the
    // root entry's re-exported `sql` / `.execute()`, which no import
    // restriction can see. apps/web/test/** is outside this glob on purpose:
    // the probe fixtures in test/eslint-db-wall.test.ts must contain these
    // exact strings to prove the rules fire, a test file ships to nobody, and
    // the import bans above still cover the whole app. T-LINT-7 pins the
    // exemption; T-LINT-5/T-LINT-5b pin that the rule still fires under
    // src/ and app/.
    files: [
      `apps/web/app/**/*.${webWallExtensions}`,
      `apps/web/src/**/*.${webWallExtensions}`,
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        // Repeated, not inherited. Flat config REPLACES a rule's whole
        // configuration when a later object sets the same rule id — it does
        // not merge the options — so omitting these selectors here would
        // silently reopen the dynamic-import and require() doors for exactly
        // the files that hold the credential (apps/web/src/db.ts). Proven red
        // by T-LINT-4/T-LINT-4b/T-LINT-4c against the plan's original
        // two-object shape; do not "de-duplicate" them away.
        webDynamicDbImport,
        webDynamicPackageSource,
        webComputedDynamicImport,
        webRequireCall,
        webTableNameLiteral,
        webTableNameTemplate,
      ],
    },
  },
  {
    // (3) THE FREE-PLAY WALL (#28, ADR-0046) — see the constants' header
    // comments above. Placed AFTER objects (1) and (2), and REPEATING their
    // arrays: flat config replaces, never merges, so this object is the
    // ENTIRE wall for the files it matches. T-LINT-S14/S15 are the
    // replacement-regression controls; T-LINT-S9…S13 and S16…S18 probe the
    // free-play bans themselves (apps/web/test/eslint-free-play-wall.test.ts).
    files: [
      `apps/web/src/free-play/**/*.${webWallExtensions}`,
      `apps/web/app/modo-livre/**/*.${webWallExtensions}`,
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [...webWallImportPatterns, ...freePlayBannedModuleGroups],
          paths: webWallImportPaths,
        },
      ],
      "no-restricted-syntax": [
        "error",
        webDynamicDbImport,
        webDynamicPackageSource,
        webComputedDynamicImport,
        webRequireCall,
        webTableNameLiteral,
        webTableNameTemplate,
        freePlayDynamicBannedModule,
      ],
    },
  },
  {
    // (4) THE OG WALL (#34, ADR-0054 decisions 8 and 15). Placed AFTER
    // objects (1), (2) and (3), and REPEATING (1)'s and (2)'s arrays for the
    // reason the free-play object above repeats them: flat config REPLACES a
    // rule's whole configuration per matching file — it never merges — so
    // this object is the ENTIRE wall for the files it matches, and its globs
    // are a strict subset of (1)'s and (2)'s.
    //
    // MEASURED, not assumed: against a version of this object declaring only
    // the games ban, all eight db-wall probes that red here today lint CLEAN
    // — the db subpath, the relative reach into packages/db/src, `sql` and
    // `users` off the root entry, `stripDailyContent` off @miolos/core, the
    // two table-name selectors, the computed dynamic import and require().
    // These are the TEN files in the app that call `getDb()` on an
    // unauthenticated crawler-facing path — the eight dated image routes plus
    // `app/cartao/[data]/route.ts` and `app/cartao/mes/[mes]/route.ts` (#104,
    // ADR-0071), which reach it through `listArchivedDays` rather than a
    // projected reader. That is the most consequential place in the repo to
    // lose those bans, and a file-diff criterion cannot see the loss.
    // T-LINT-S43/S44/S54 and T-LINT-S8a are the regression controls.
    // Do not "de-duplicate" the spreads away.
    //
    // THIS WALL IS NOT TRANSITIVE, and it does not pretend to be (step-6
    // finding P2). `no-restricted-imports` sees the specifiers a file writes
    // and nothing behind them, so a module that itself re-exports something
    // from `@miolos/games` would pass. The free-play object above answers
    // the same hole by banning one-hop modules BY NAME
    // (`freePlayBannedModuleGroups`); the OG surface needs no such list
    // TODAY because its whole one-hop set is `src/i18n`, `src/db`,
    // `src/archive/parse-params`, `@miolos/db` and `@miolos/core`, none of
    // which reaches `@miolos/games`. A new import into `src/og/**` that does
    // owes an entry here.
    files: [
      `apps/web/src/og/**/*.${webWallExtensions}`,
      // `**` matches ZERO segments here, so this reaches the ROOT card
      // `apps/web/app/opengraph-image.tsx` as well as the eight nested ones
      // — verified against this repo's own eslint, not assumed (T-LINT-S44).
      `apps/web/app/**/opengraph-image.${webWallExtensions}`,
      // `twitter-image` is covered although the root layout's `twitter`
      // defaults mean none will ever be needed: if one ever is, it must not
      // arrive OUTSIDE the wall, and the cost is one token and one probe.
      `apps/web/app/**/twitter-image.${webWallExtensions}`,
      // #104 (ADR-0071): the two archive shell cards are ROUTE HANDLERS at
      // their own URLs, not metadata modules, so the two globs above do not
      // match them — `app/cartao/[data]/route.ts` ends in `route.ts`. They
      // call `getDb()` on the same unauthenticated crawler-facing path and
      // must be inside this wall. `apps/web/app/cartao/**` is a strict subset
      // of (1)'s and (2)'s globs, whose arrays this object already repeats
      // verbatim, and it intersects neither (3) (free play) nor (5)
      // (modo-livre ∩ OG) — an intersection ANALYSIS, not a claim that there
      // is no intersection. That is ADR-0054 decision 15's widened rule, in
      // its own words: the header comment is corrected from "a subset of
      // (1)'s or (2)'s" to **any intersection with any earlier object**.
      // (Quoted, not cited by line: this PR annotates ADR-0054 in place, so a
      // `:NNN` here would be stale on arrival.)
      `apps/web/app/cartao/**/*.${webWallExtensions}`,
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [...webWallImportPatterns, ...ogBannedGameGroups],
          paths: webWallImportPaths,
        },
      ],
      "no-restricted-syntax": [
        "error",
        webDynamicDbImport,
        webDynamicPackageSource,
        webComputedDynamicImport,
        webRequireCall,
        webTableNameLiteral,
        webTableNameTemplate,
        ogDynamicGamesImport,
      ],
    },
  },
  {
    // (5) THE INTERSECTION OF (3) AND (4) (#34, step-6 finding K1). Placed
    // LAST, and it exists because flat config replaces per rule: an
    // `app/modo-livre/**/opengraph-image.tsx` matches object (3)'s
    // `apps/web/app/modo-livre/**` AND object (4)'s
    // `apps/web/app/**/opengraph-image.*`, so (4) — the later object — would
    // become that file's ENTIRE wall and silently delete free play's bans.
    //
    // MEASURED against the shipped config before this object existed: at
    // `app/modo-livre/opengraph-image.tsx`, `play/sync`, `play/share-text`,
    // `@miolos/db`'s ROOT entry, `streak` and a dynamic `play/sync` all lint
    // CLEAN, while the same five red at the control `app/modo-livre/page.tsx`.
    // The root-entry loss is the sharpest of them: object (3) bans `@miolos/db`
    // outright and `webWallImportPatterns` PERMITS it, so the intersection was
    // strictly weaker than either parent. `T-LINT-S46` is the probe.
    //
    // No file matches this object today and that is the point — a wall for a
    // path that does not exist yet is a wall doing its job, the same argument
    // object (4) makes for `twitter-image`. Repeats (1)'s, (2)'s, (3)'s and
    // (4)'s arrays; do not "de-duplicate" them away.
    files: [
      `apps/web/app/modo-livre/**/opengraph-image.${webWallExtensions}`,
      `apps/web/app/modo-livre/**/twitter-image.${webWallExtensions}`,
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...webWallImportPatterns,
            ...freePlayBannedModuleGroups,
            ...ogBannedGameGroups,
          ],
          paths: webWallImportPaths,
        },
      ],
      "no-restricted-syntax": [
        "error",
        webDynamicDbImport,
        webDynamicPackageSource,
        webComputedDynamicImport,
        webRequireCall,
        webTableNameLiteral,
        webTableNameTemplate,
        freePlayDynamicBannedModule,
        ogDynamicGamesImport,
      ],
    },
  },
  prettier,
);
