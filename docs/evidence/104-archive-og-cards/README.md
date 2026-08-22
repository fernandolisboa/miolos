# Evidence — #104 OG cards for the archive index, month and day (plan 068)

The three cards themselves at **1200×630**, embedded in the PR body by
SHA-pinned raw URL. Not page screenshots: **no page changes visually**, so a
`390x844`/`1440x900` pair would be two identical images (plan 068 §12.3).

Each PNG is the shipped `archiveCard()` rasterised through the real
`ImageResponse` at the real size with the real committed faces — the same call
the route makes — not a `file://` component harness of the #64/#163 kind,
where the page shell does not lay out and (at #64) `next/font` never resolves
at all. **These are the production rasterisations**, so the text metrics and
the geometry are the shipped ones.

| File | What it shows |
|---|---|
| `after-index-1200x630.png` | the committed index card — `Arquivo` over `ogCopy.archiveTagline`, the 39-character first sentence of `messages.archive.lead` (`T-WEB-S206a` pins it as a prefix). **Byte-identical to `apps/web/app/arquivo/opengraph-image.png`** (`sha256:a6b65793…`), the asset `T-WEB-S212` pins |
| `after-day-1200x630.png` | the day card at **rung 2** and at the measured worst case — `20 de novembro` at 96 px over `de 2028 · Arquivo` at 39 px |
| `after-month-1200x630.png` | the month card at the **widest** month — `novembro de 2028`, over the constant caption `Arquivo` |

## No `before-*.png`, and why

Before #104 all three archive surfaces inherited the **root site card**, and a
malformed or wall-refused archive segment still does — the implementer measured
`/arquivo/nao-e-data` and `/arquivo/1999-01-01` advertising
`/opengraph-image.png` exactly as before this ticket, and confirmed that
`app/arquivo/opengraph-image.png` serves `/arquivo` and **nothing under it**
(an `opengraph-image` file reaches descendants only from a segment owning a
`layout.tsx`, and `app/arquivo/` owns none).

So the "before" is a real, identifiable image — the generic `Miolos` /
`Quatro jogos de raciocínio por dia.` nameplate — and it is **already a
committed 1200×630 binary in this repo**, at `apps/web/app/opengraph-image.png`,
added by #34 (`9368518`) and byte-unchanged on this branch (`git diff main` on
it is empty).

**The PR body still shows the before/after pair.** It just SHA-pins that path
for the "before" half, which renders the identical image with no duplicate. A
copy here would buy nothing and cost a second binary that `T-WEB-S212` does not
guard — free to drift from the asset it claims to depict.

(Plan §12.3 says this "before" was "already evidenced at #34". It was not:
there is no `docs/evidence/34-*` directory. The asset itself is the record,
and it is the better pin, because it is the file the site actually serves.)

## The worst case is measured, not sampled

The step-5 sizing harness (plan §12.2) rendered each candidate string through
the real `ImageResponse` + `FONTS`, gave the text node a solid `#FF0000`
background so the painted box IS its layout box, and read the extent back with
`sharp`. These are **satori's own layout widths**, not `.length` arithmetic.

Inner width available to the display line: **890 px**.

| Rung | String at 96 px Fraunces 500 | Width | vs 890 px |
|---|---|---|---|
| 1 | `20 de novembro de 2028` (`formatLongDate`, worst of 366 enumerated) | **1111 px** | **OVER by 221 px** |
| 1 | `24 de novembro de 2028`, `29 de novembro de 2028` | 1107 px | over |
| **2** | **`20 de novembro`** (`formatDayAndMonth`) | **729 px** | **fits, 161 px spare** |

Rung 1 fails by 25 %, and **satori overflows a fixed container silently rather
than wrapping visibly** (plan 040 `:847`) — so the overflow would have been
painted off the card with nothing to see. The day card therefore takes rung 2,
with the year moved to the 39 px caption (`de 2028 · Arquivo`, 307 px).

Month card, all twelve enumerated at 96 px as `<mês> de 2028`, widest first —
every one fits:

| # | Month | Width | # | Month | Width |
|---|---|---|---|---|---|
| **1** | **novembro** | **843 px** | 7 | agosto | 679 px |
| 2 | dezembro | 829 px | 8 | março | 671 px |
| 3 | setembro | 806 px | 9 | junho | 643 px |
| **4** | **fevereiro** | **790 px** | 10 | julho | 613 px |
| 5 | outubro | 745 px | 11 | maio | 608 px |
| 6 | janeiro | 700 px | 12 | abril | 593 px |

Captions at 39 px Instrument Sans 400, all fitting: `Todos os puzzles do dia
desde o começo.` 732 px, `de 2028 · Arquivo` 307 px, `Arquivo` 143 px. Index
display `Arquivo` at 96 px: 363 px.

### 890 px, not 896

Plan §3.1 computed `CARD_BOX_WIDTH − 2 × CARD_PADDING` = `1040 − 144` = 896 and
**forgot `paper()`'s `border: 3px solid`**. Yoga resolves `width` as a
*border*-box, so the content box is `1040 − 144 − 6` = **890**. The harness
measured 890 directly, agreeing to the pixel. Rung 1 fails against either
number, so nothing downstream turns on the correction — but `T-WEB-S333` and
the `archiveCard` doc block carry the measured figure, not the plan's.

### novembro, not fevereiro — because Fraunces' figures are not tabular

Plan 068 §12.3 specified the month fixture as `fevereiro de 2026`, inheriting
#163's seasonal worst case (`fevereiro` is the longest month *name*, and plan
040 `:849` named `22 de fevereiro de 2026` as the longest date by `.length`).
**Measured, `fevereiro` is only the fourth widest**, and the widest date string
is 22 characters rather than 23.

The cause is in the face: at 96 px Fraunces, the ten digits measure

```
0:63  1:43  2:58  3:53  4:59  5:55  6:58  7:50  8:57  9:58
```

— a 20 px spread between `1` and `0`. So `"20"` is the widest day pair, and
character count is not width. Shipping the plan's `fevereiro de 2026` would
have been a fixture **53 px narrower** than the case that actually decides the
composition.

One residual, measured and bounded rather than rendered: the harness enumerated
months against the year 2028, and the widest four-digit year in range (`2090`)
adds **6 px** — a true ceiling of **849 px**, still 41 px inside 890. The
fixture is the worst *month*; the worst *year* is arithmetic on the digit table
above.

### Corroboration from the committed PNGs themselves

Ink bounding boxes read back off the three files here (dark-pixel extent, so
they exclude side bearings and run a few px under the layout box):

| Card | Line | Layout width (harness) | Ink width (these PNGs) |
|---|---|---|---|
| day | `20 de novembro` | 729 px | 718 px (x 159–876) |
| day | `de 2028 · Arquivo` | 307 px | 303 px |
| month | `novembro de 2028` | 843 px | 835 px (x 158–992) |
| month | `Arquivo` | 143 px | 138 px |
| index | `Arquivo` | 363 px | 356 px |
| index | `Todos os puzzles…` | 732 px | 727 px |

Every line agrees within ~1 %, and every line's ink starts at x ≈ 156–159,
against a content box whose left edge is `(1200 − 1040)/2 + 3 border + 72
padding` = **155** and whose right edge is therefore `155 + 890` = 1045. The
widest line on any card, the month display, ends at x 992 — 53 px clear. That
is the second, independent confirmation of the 890 px figure.

## How to regenerate

The index card has a first-class path, because it is a committed runtime asset
guarded by `T-WEB-S212`:

```
WRITE_ARCHIVE_CARD=1 pnpm --filter @miolos/web test og-image
```

The day and month PNGs are evidence, not assets, so they come from a throwaway
suite in `apps/web/test/` that calls the **shipped builder with the handlers'
own argument shapes** (`src/og/handlers.ts:215-217,244-247`) and writes the
buffer.

**It must open with the `// @vitest-environment node` docblock pragma.**
`apps/web/vitest.config.ts` sets `environment: "jsdom"` and has no
`environmentMatchGlobs`, so the `.node.test.ts` suffix is a naming convention
that selects nothing — the pragma is what switches the environment. Without
it the render dies inside `Sharp._createInputDescriptor`, because jsdom's
realm-local `TextEncoder` yields a `Uint8Array` that fails sharp's
`instanceof` check in the Node realm. `og-image.node.test.ts:1` carries the
pragma and its docblock explains the same trap; this README repeats it because
a throwaway file is written from scratch, where a missing first line is
invisible.

```ts
archiveCard({ display: formatDayAndMonth("2028-11-20"),
              caption: ogCopy.archiveDayCaption("2028") })   // after-day
archiveCard({ display: formatMonth("2028-11-01"),
              caption: messages.archive.title })             // after-month
archiveCard({ display: messages.archive.title,
              caption: ogCopy.archiveTagline })              // after-index
```

each through `new ImageResponse(tree, { width: CARD_WIDTH, height: CARD_HEIGHT,
fonts: FONTS })`. Run it under `scripts/gate-lock.sh acquire` and delete the
file after. Changing the date literals is the only way to change the fixture:
**a string that does not fit is a failure of the composition, not a fixture to
be swapped for a shorter one** (plan §12.2).

This recipe was run against the three files committed here, and all three come
back **byte-identical** — SHA-256 `a6b65793…` (index), `7cdc9755…` (day),
`4cc85dc4…` (month). So these PNGs are provably the shipped builder's own
output at this commit, not a stale or hand-made fixture.

## What these images do NOT prove

They are three rasterisations of one function. Read narrowly:

- **They do not prove any route serves them.** `/cartao/<data>` and
  `/cartao/mes/<mes>` are runtime handlers with a database read and a
  publication-wall check in front of the builder. What proves those is the
  `next start` block in the PR body — `200` + `image/png` +
  `private, no-cache, no-store, max-age=0, must-revalidate` on a date
  **discovered from `/arquivo`** (ADR-0053 decision 12), and `404` with the
  same `cache-control` on a future date, a malformed segment and an empty
  month.
- **They do not prove the pages point at them.** That is the `og:image` /
  `twitter:image` head grep, plus `T-WEB-S173`'s metadata suites.
- **`2028-11-20` is not a real archived day.** It is a synthetic width worst
  case; no puzzle exists for it and no user will ever see this exact card. It
  is here because it is the widest thing the composition must survive, which a
  real mid-length date shows nothing about — the #64 mistake, not repeated.
- **They do not prove design compliance.** A PNG is not a detect run. The gate
  is **file-mode `npx impeccable detect`** over `archiveCard()`'s tree with the
  real `tokens.css` and the committed faces — ADR-0034 decision 4, *paraphrased
  as a paraphrase*: design compliance on a surface the URL scan cannot reach is
  proved by a file-mode detect run. It returned `[]` on all three cards, and it
  was proved non-vacuous by scanning the same three files from outside the
  repo, where `.impeccable/config.json` does not apply and the two waived
  `overused-font` findings duly fire. `git diff main -- .impeccable/config.json`
  is empty, and is an exit criterion: **a rule firing on a card is fixed in the
  card, never in the ignore list.**
- **They do not prove the index card is what `/arquivo` serves.** The byte
  equality does: `T-WEB-S212` re-renders `archiveCard()` and compares SHA-256
  against the committed PNG, so a token change or a font swap that never
  reaches the file reds at commit time.
- **They say nothing about the pages.** #104 changes no page markup or CSS.
- **They cannot show a refusal.** An unpublished date produces no image at all;
  only the `curl` block can show that.
