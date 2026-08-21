# Evidence — #163 the archive is a real clickable calendar (plan 065)

Step-5 before/after screenshots, embedded in the PR body by SHA-pinned raw
URL. Fixtures are the napkin's Shell-6 idiom (#35/#142/#161): the REAL
components rendered by a throwaway vitest file, CSS-module classes unhashed
with `/_([A-Za-z0-9-]+)_[0-9a-z]{6}/g → $1`, wrapped over the real
`tokens.css` + `globals.css` + `arquivo.module.css` and the committed
`@font-face` files via absolute `file://` paths, shot with the repo's own
puppeteer after `document.fonts.ready`. The *before* half links **main's**
`arquivo.module.css` under markup rendered from **main's** own archive views
(checked out for the length of that render and restored immediately), so the
pair differs only by this branch.

The seasonal worst case is measured, not sampled (napkin Execution 9 — both
archive gate breaks were calendar-dated): **2026-08** is 31 days starting on
a Saturday, the only month shape that needs six week rows, and **fevereiro**
carries the longest month name ("fevereiro de 2026", 17 characters).

| File | What it shows |
|---|---|
| `before-index-{390x844,1440x900}.png` | main's index — "Dias recentes", seven day rows |
| `after-index-{390x844,1440x900}.png` | the newest month's grid over the surviving "Por mês" chips; days 1–20 linked, 21–31 inert |
| `before-month-{390x844,1440x900}.png` | main's month page — 31 day rows, the shape that fired `first-viewport-column-overflow` at 21 |
| `after-month-{390x844,1440x900}.png` | the six-week worst case as a grid |
| `after-fevereiro-{390x844,1440x900}.png` | the longest heading over a 28-day month |
| `after-sparse-index-390x844.png` | the ragged floor's own shape — one linked day in the newest month |

Measured at shoot time (`shoot.mjs`, `getBoundingClientRect`):

| Surface | Viewport | Page height | Cell box |
|---|---|---|---|
| month, before | 390×844 | 2489 px | 350 × 71 (a row) |
| month, after | 390×844 | **844 px** | **44.58 × 44.58** |
| month, before | 1440×900 | 2232 px | 600 × 60 (a row) |
| month, after | 1440×900 | **900 px** | **44 × 44** |
| index, before | 390×844 | 1031 px | — |
| index, after | 390×844 | **850 px** | 44.58 × 44.58 |

Every cell clears the 44 px touch floor on BOTH axes (`aspect-ratio: 1`), and
the month page stops growing with the archive: it is one grid at every month
size, so the 1.4×-viewport-height overflow trigger can no longer be reached
by the calendar filling up.

`npx impeccable detect` over each fixture reports exactly one anti-pattern,
`cream-palette`, **identically before and after** — the by-design `file://`
finding (the repo's waiver is scoped to http origins) and itself the proof
the stylesheets loaded. The binding scan is the `Impeccable` workflow on the
PR's Vercel preview.
