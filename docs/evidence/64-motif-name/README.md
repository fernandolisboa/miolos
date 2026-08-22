# #64 — the named Nonogram reveal

The motif caption on the daily conclusion (ADR-0070): an impersonal
tracked-uppercase kicker over the curated pt-BR name.

| File | What |
|---|---|
| `after-reveal-*.png` | the caption, with the name published on the day claim |
| `before-reveal-*.png` | the same composition with no name — today's shipped reveal, unchanged |

Both viewports: 390×844 and 1440×900. The fixture renders the **longest name
in the shipped library — `Bolo de aniversário`, 19 characters** — rather than
today's motif, because a mid-length name shows none of the behaviour worth
looking at. At 390 px it wraps to two lines (`BOLO DE` / `ANIVERSÁRIO`), which
is the shape to judge; a first version of these screenshots used `Caranguejo`
(10 chars) while the text below claimed it was the longest, and the two
contradicted each other.

## How these were produced, and what they do NOT prove

A `file://` fixture of the real `<ConclusionView/>` with the real
stylesheets, CSS-module hashes stripped (napkin § Shell 6). It is a
**component** harness, not the page:

- **next/font never resolves over `file://`**, so `impeccable detect` reports
  `single-font: times new roman` on it. Text metrics are therefore not the
  shipped ones.
- **The page shell's grid does not lay out**, so the `.pictureRow` box
  overlaps neighbouring cards and the crops above are tighter than the real
  screen. Every `text-occlusion` the detector reports on this fixture is
  downstream of that, and **the same findings appear on the `before`
  control** — the unmodified shipped composition, which #64 does not touch.
- `cream-palette` firing is the stylesheet-loaded proof, dismissed with that
  reason (napkin § Shell 6).

So the fixture is used for **what the caption looks like** and for a
**control diff**, never as the detect gate.

## The detect evidence, and where the real gate is

`npx impeccable detect file://…`, both viewports, `before` control vs
`after`:

- **identical finding types** at both viewports;
- **no finding names `.pictureName`, `.pictureLead` or `.pictureCaption`**;
- **no `all-caps-body`, `kicker-above-heading`, `hero-eyebrow-chip`,
  contrast or `line-length` finding** at either viewport — the five rules the
  caption could plausibly trip.

The repo's real detect gate is the `Impeccable` workflow against the Vercel
preview, which runs on the PR and covers every URL-reachable page. **The
solved conclusion is not among them**: it needs a solved day, and a clean
profile's `GET /day` answers 401 — ADR-0065 consequence (c) recorded the same
unreachability for #142's completed view.

## What is gated mechanically instead

`all-caps-body` fires on **> 30 characters of direct text** under
`text-transform: uppercase`, and this caption renders **content from a
library that grows** — the exact data-dependent shape that broke twice on
#31, invisibly to CI and to any commit. So it is pinned as a unit test,
two-sided because `apps/web` may never import `MOTIFS` (that import ban is
what keeps the bundle grep meaningful, ADR-0070 consequence (c)):

- `T-WEB-S330` (`apps/web/test/nonogram-motif-name.test.tsx`) — both lines
  really are uppercase, and the fixed lead fits;
- `packages/games/test/nonogram/name-length.test.ts` — every one of the 184
  curated names fits, and none is blank.

Today's worst case is **`Bolo de aniversário`, 19 characters**, against a
threshold of 30. A 31-character motif added years from now reds at commit
time rather than at a preview scan nobody can run.
