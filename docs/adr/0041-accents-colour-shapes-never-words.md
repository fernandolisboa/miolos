# ADR-0041 — Accents colour shapes, never words

**Status:** Accepted — 2026-08-02
**Depends on:** [ADR-0002](./0002-plain-react-web-ui-not-universal-rn-web.md), [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md)
**Amends:** `DESIGN.md:22` — *"Accents carry identity, not meaning alone — every state they mark is also carried by a chip, border, or label."* — and `DESIGN.md:20`'s list of sanctioned accent surfaces, which still names the **kicker**. Also `PRODUCT.md:40`'s Accessibility bullet, which states the ≥4.5:1 floor without saying which surfaces may carry an accent at all. Both files are edited in the commit that lands this ADR; `CLAUDE.md` names the PAIR as the living design context, so amending one and leaving the other is amending nothing (ADR-0036 decision 3's rule). **No token value moves.**

## Context

The Ateliê palette gives each game one accent and uses it for tape, kicker,
stamp and button (`DESIGN.md:20`). Three of the four accents are dark
enough for that to be legal. One is not, and the arithmetic was measured
rather than recalled:

```
--accent-termo #C08A1E → rgb(192,138,30)
R: 192/255=0.75294118 → (0.76582102)^2.4 = 0.52711513
G: 138/255=0.54117647 → (0.56509618)^2.4 = 0.25415209
B:  30/255=0.11764706 → (0.16364650)^2.4 = 0.01298303
L = 0.2126(0.52711513)+0.7152(0.25415209)+0.0722(0.01298303) = 0.29477163
```

| pair | ratio |
|---|---|
| `--accent-termo` on `--paper-desk` (L 0.89161610) | **2.7311:1** |
| `--accent-termo` on `--paper-card` (L 0.93262753) | **2.8501:1** |
| `--accent-termo` on `--paper-tint` (L 0.82766867) | **2.5457:1** |
| `--ink` #211D19 (L 0.01272250) **on** `--accent-termo` | **5.4968:1** |
| `--ink-2` #6E6659 (L 0.13539008) **on** `--accent-termo` | 1.8597:1 |

Four separate documents and one test comment carry the figure **2.736:1**
for the card case. It is wrong; the value is **2.8501:1**. The conclusion
is unchanged — both fail AA and both fail WCAG 1.4.11's 3:1 non-text floor
— but it was quoted as measured evidence and the correction belongs on the
record.

**2.8501:1 is the ceiling over the whole paper family, against a 4.5
floor.** No paper token rescues mustard. That is what makes this a decision
about the system rather than a bug in one screen.

`--ink-on-accent` (`apps/web/src/play/accent.ts:65-77`) already fixed the
half where a light label sits ON an accent fill, for Nonogram, by choosing
a different paper. Its remaining half — accent-coloured TEXT on paper — is
filed as [#68](https://github.com/fernandolisboa/miolos/issues/68), whose
own "what a fix probably looks like" offers two shapes: darken the four
accent tokens, or make `--accent` decorative-only and pair it with a
derived text token.

Fernando decided it on 2026-08-02, recorded in
`docs/handoffs/021-handoff-m2-termo-and-free-play.md:173`: *"accents colour
shapes, not words. The token values **stay**; accent stops being a text
colour on paper."*

The trigger is #27. `apps/web/src/i18n/routes.ts:52-56`'s `playRoutes`
gains `termo` and, in the same instant, four surfaces begin painting a
2.7311:1 label — including `conclusion-view.module.css:431-436`'s
`.ctaNext`, which wears the **destination** game's accent and therefore
renders on the already-shipped `/binairo`, `/sudoku` and `/nonogram`
conclusions. That is #25's ISS-A2 regression repeated with mustard, on
three screens #27 does not otherwise touch.

## Decision

1. **An accent may colour a shape. It may never colour a word.**
   Sanctioned accent surfaces: a fill, a washi tape, a hard shadow, a rule,
   a stamp ring, a card border, a graph bar, a board cell. Forbidden: any
   `color:` declaration on text, at any size, on any paper. `DESIGN.md:20`'s
   list drops **kicker** and gains this sentence in its place.

2. **`--ink-on-accent`'s range is "an ink that is legible on this accent",
   not "a paper token".** `accentVars("termo")` returns `var(--ink)` —
   **5.4968:1** on mustard. Sudoku, Nonogram and Binairo do not move:
   7.5113:1, 4.5063:1 and 5.3066:1 already clear AA, and changing them
   would be a byte-visible change to shipped screens with no defect behind
   it. Termo is simply the first accent light enough (L 0.29477163,
   greyscale 148/255) to carry dark ink.

3. **Every `--accent`-as-text site in the three shared stylesheets
   converts, in one commit.** Eleven sites, six of which #68's table does
   not list, and one of which — `apps/web/app/page.module.css:150`'s hub
   kicker on the Termo card — is a live 2.8501:1 failure on `main` today.
   Every line below was opened and is `color: var(--accent);`:

   | site | → | ratio after |
   |---|---|---|
   | `play/screen.module.css:120` `.titleKicker` | `var(--ink-2)` | 5.0791:1 |
   | `play/screen.module.css:98` `.barKicker` | `var(--ink-2)` | 5.0791:1 |
   | `play/screen.module.css:196` `.statLabel` | `var(--ink-2)` | 5.3003:1 |
   | `play/conclusion-view.module.css:97` `.barKicker` | `var(--ink-2)` | 5.0791:1 |
   | `play/conclusion-view.module.css:139` `.cardKicker` | `var(--ink-2)` | 5.3003:1 |
   | `play/conclusion-view.module.css:176` `.stamp` (text) | `var(--ink)` | 15.6663:1 |
   | `play/conclusion-view.module.css:354` `.chipDone .chipName` | `var(--ink)` | 14.2637:1 |
   | `app/page.module.css:150` `.kicker` | `var(--ink-2)` | 5.3003:1 |
   | `app/page.module.css:222` `.doneChip` (text) | `var(--ink)` | 15.6663:1 |
   | `play/screen.module.css:56` + `play/conclusion-view.module.css:25` `.page a:hover` | see decision 4 | 15.0124:1 |

4. **A hover affordance keeps its per-game identity by moving the accent to
   a shape.** `.page a:hover` becomes `color: var(--ink)` plus a 2px
   `text-decoration-color: var(--accent)` underline. The word is ink
   (15.0124:1); the rule under it is the accent; the state's carrier is the
   underline's **presence**, not its hue.

   **This is an accepted exception, and its ratio is written down rather
   than left to be rediscovered — the treatment decision 5 gives the stamp
   ring.** The underline is **2.7311:1** against `--paper-desk` (2.8501:1 on
   `--paper-card`), below WCAG 1.4.11's 3:1. It is accepted on two grounds
   and neither is "it complies": hover is a **pointer-only** affordance that
   duplicates information the link already carries at 15.0124:1 and is not a
   state a user must be able to perceive to operate the control; and a solid
   2px band appearing where there was none is a change of **geometry**, so
   the state survives greyscale and survives a user who never sees the hue.
   A future contributor may not cite this line to put a mustard rule under a
   *state-bearing* boundary — that is the case ADR-0042's Rejected list
   refuses for the `present` tile.

5. **An accent border that outlines an already-legible label is decoration;
   an accent border that is the only thing saying which state a control is
   in is not.** The conclusion's stamp ring and the hub's done-chip ring
   keep `var(--accent)` — 2.8501:1 for Termo — because the words they
   enclose are at 15.6663:1 and carry the whole message. WCAG 1.4.11's
   decorative exemption applies, and the figure is written down rather than
   left for someone to rediscover.

6. **The token values do not move.** `--accent-termo` stays `#C08A1E`.
   Darkening the palette is the option Fernando rejected, and no ticket may
   reopen it without a new ADR.

7. **The documented 2.736:1 is corrected to 2.8501:1 in living code only.**
   `apps/web/src/play/accent.ts` and `apps/web/test/ink-on-accent.test.ts`
   are edited. `docs/handoffs/021-…`, `docs/plans/020-…` and issue #68's
   body are **not**: `docs/README.md:19-21` makes a handoff and a plan
   point-in-time snapshots whose bodies are never rewritten. The correction
   lives here and in #68's closing comment.

## Rejected

- **Darkening the four accent tokens to clear 4.5:1 on `--paper-desk`.**
  The option #68's body offers first, and the one Fernando decided against
  on 2026-08-02. It would change the palette of a chosen design winner to
  serve a contrast property that a placement rule already solves.
- **A new `--accent-text` token, derived to clear AA.** A third mechanism
  where the second already generalises, and for mustard its value would be
  a darkened mustard — i.e. the palette change just rejected, wearing a
  different name.
- **Converting only Termo's sites and leaving the other three games
  accent-coloured.** Mechanically impossible without forking: CSS Modules
  hash per file (plan 018 landmine 24), so a `.titleKicker` in a per-game
  module is a different class and overriding the shared one would rest on
  Next's stylesheet injection order, which it does not guarantee. Forking
  would leave the shared sheet contradicting `DESIGN.md` and hand the next
  game a fifth copy.
- **Deferring the conversion past `/termo`'s launch and shipping the screen
  with a 2.7311:1 kicker.** #27 is instructed by handoff 021 landmine (c) to
  carry this rule into `DESIGN.md`. An ADR stating a rule that eleven shipped
  surfaces contradict is the false-document class ADR-0036 consequence (b)
  names. What replaces the deferral is an **ordering**, not a merge: the #68
  PR lands first and #27 rebases on it (consequence (a)), so the rule and its
  eleven implementations are true before `playRoutes` gains `termo`.
- **Reading ADR-0036 decision 5 as a precedent for deferring.** That
  decision refused to fix `.timerCard` inside a Nonogram ticket because the
  change was *unrelated* to it. This change is (i) the direct
  implementation of a rule #27 must record, (ii) mechanically required for
  `/termo` to render legally, and (iii) unachievable Termo-only.
  ADR-0036's case had none of the three.

## Consequences

- **(a) Three shipped screens change appearance, deliberately, and this
  decision ships as its OWN pull request.** `/binairo`, `/sudoku`,
  `/nonogram` and their conclusions lose their coloured kickers and chip
  names. **This ADR depends on no Termo code and must stay that way**:
  everything it decides is expressible against the tree as it stands on
  `main` — four accent tokens, three shared stylesheets, `accent.ts` and its
  test. It therefore lands in the PR that closes
  [#68](https://github.com/fernandolisboa/miolos/issues/68), on branch
  `fix/68-accents-colour-shapes`, **merged before** #27's branch rebases on
  it — one issue per branch, as `CLAUDE.md` requires, and independently
  revertible without touching Termo. `npx impeccable detect` is re-run on
  all seven existing routes at 1440×900 and 390×844 before Termo exists,
  and that PR's body states the repaint as a thing Fernando has to look at.
- **(b) [#68](https://github.com/fernandolisboa/miolos/issues/68) is closed
  by that PR.** Every row on its table is addressed — its three listed
  sites plus its `.cta` row, which decision 2 fixes — and six sites it does
  not list.
- **(c) `--ink-on-accent`'s fallback is no longer uniform, and one site will
  say so.** Every existing consumer reads `var(--ink-on-accent,
  var(--paper-desk))`. Termo's board tile is the one surface in the repo
  that can *only ever* render mustard, so it reads `var(--ink-on-accent,
  var(--ink))` — the safe fallback for the one accent where desk is
  2.7311:1. What this ADR fixes is the **shape** of the gate:
  `apps/web/test/ink-on-accent.test.ts` carries an expected fallback per
  site rather than one literal for all of them, over the `SHEETS` list it
  already scans (`ink-on-accent.test.ts:35-40`). The Termo board's own row
  and sheet are added by the PR that ships the board, because the file does
  not exist until then; splitting it that way is what keeps this ADR
  landable on its own.
- **(d) The identity argument survives the colour leaving.** `PRODUCT.md`
  principle 1 — *"Typography is the protagonist. Hierarchy, warmth and
  identity come from Fraunces + Instrument Sans, not from ornament"* — is
  what makes an 11px uppercase 0.16em kicker still a kicker in `--ink-2`.
  The accent stays on the tape, the shadow, the stamp ring, the fill and
  the board, which is more accent surface per screen than the kicker ever
  was.
- **(e) The native clients inherit a token set with a stated placement
  rule**, rather than four hexes and a screen to copy. #68's closing
  sentence asked for exactly this: *"Should land before the native clients
  inherit the token set."*
- **(f) `impeccable detect` cannot see any of this and never will.**
  `low-contrast` and `cream-palette` are wildcard-ignored on every host CI
  scans (`.impeccable/config.json:19-39`,
  [#51](https://github.com/fernandolisboa/miolos/issues/51)). The gate on
  decision 2 is `apps/web/test/ink-on-accent.test.ts`, which asserts
  stylesheet TEXT because jsdom resolves no custom-property fallback chain.
  There is no automated gate on decisions 1, 3 or 4 — a future `color:
  var(--accent)` on text passes CI green, and the only defence is this ADR
  plus a stylesheet-text scan the same test file can carry.
- **(g) The accent inventory was swept for `color:`, `border:` and
  `background:` declarations only.** A `fill:`, a `stroke:`, a
  `text-decoration-color:` or a `caret-color:` carrying `var(--accent)`
  would not have been found. `conclusion-view.module.css:246`'s `fill:
  var(--accent)` on `.picture` is a *shape* and is correct under decision 1;
  no exhaustive sweep for others has happened, and this ADR does not claim
  one.
