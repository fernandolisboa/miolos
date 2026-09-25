# ADR-0041 — Accents colour shapes, never words

**Status:** Accepted — 2026-08-02
**Depends on:** [ADR-0002](./0002-plain-react-web-ui-not-universal-rn-web.md), [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md)
**Amended by:** [ADR-0048](./0048-the-streak-is-a-client-fetched-server-computed-value.md) — consequence (h)'s enumeration grows rows 14–15 for the conclusion streak card: `.streakCardNumeral` and `.streakCardLabel` in `play/conclusion-view.module.css`, `--accent-app` on `--paper-card` at **6.2980:1**, with `ink-on-accent.test.ts`'s `ALLOWED_ACCENT_TEXT` widened by the same two names — decision 1's exception mechanism, exercised rather than bypassed.
**Amended by:** [ADR-0080](./0080-paper-dark-accents-lighten-under-a-paper-label.md) — decision 1's accent-as-text allowance, decision 6 and consequence (h)'s site figures are now measured in the dark palette too, and accent-coloured text is barred from `--paper-tint` in dark, where every accent clears only 4.24–4.26:1.
**Superseded in part by:** [ADR-0067](./0067-termo-accent-deepens-to-carry-a-light-label.md) (#161) — **decision 6 is replaced for `--accent-termo`**, through the exact instrument decision 6 demanded (a new ADR): the token deepens `#C08A1E` → `#8D6212` so Termo's fills carry the same light label as the other three games, and `accentVars("termo")` returns `var(--paper-desk)` (**4.8433:1**) instead of `var(--ink)`. Decision 2's Termo value and consequence (c)'s Termo-only `var(--ink)` fallback move with it; every mustard figure in this file (2.7311 / 2.8501 / 2.5457 / 5.4968 / 1.9899, L 0.29477163) is the OLD value's, kept as the record of the decision as taken. Decisions 1, 4, 5, 8 and 9 stand — their grounds are palette-independent — and decision 4's exception is now headroom: the worst hover rule is nonogram at 4.3182:1, above 1.4.11's 3:1.
**Amends:** `DESIGN.md:22` — *"Accents carry identity, not meaning alone — every state they mark is also carried by a chip, border, or label."* — and `DESIGN.md:20`'s list of sanctioned accent surfaces, which still names the **kicker**. Also `DESIGN.md:50-51`, whose Puzzle-grid and Histogram specs prescribe **accent numerals** and an accent bar with a bold label, i.e. the surfaces decision 1's exception covers — stated absolutely, line 20 forbade what line 50 prescribed, inside the one file `/impeccable` reads as the living design context. And `PRODUCT.md:40`'s Accessibility bullet, which states the ≥4.5:1 floor without saying which surfaces may carry an accent at all. **`DESIGN.md:20` and `PRODUCT.md:40` are amended to the same sentence with the same surface list** — they had drifted apart on both ("An accent" vs "A game accent"; a graph bar in one list and not the other). Every file is edited in the PR that lands this ADR; `CLAUDE.md` names the PAIR as the living design context, so amending one and leaving the other is amending nothing (ADR-0036 decision 3's rule). **No token value moves.**

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

`--ink-on-accent` (`INKS_ON_ACCENT` in `apps/web/src/play/accent.ts`)
already fixed the half where a light label sits ON an accent fill, for
Nonogram, by choosing a different paper. Its remaining half —
accent-coloured TEXT on paper — is filed as
[#68](https://github.com/fernandolisboa/miolos/issues/68), whose own "what a
fix probably looks like" offers two shapes: darken the four accent tokens,
or make `--accent` decorative-only and pair it with a derived text token.

Fernando decided it on 2026-08-02, recorded in
`docs/handoffs/021-handoff-m2-termo-and-free-play.md:173`: *"accents colour
shapes, not words. The token values **stay**; accent stops being a text
colour on paper."*

The trigger is #27. `apps/web/src/i18n/routes.ts:52-56`'s `playRoutes`
gains `termo` and, in the same instant, four surfaces begin painting a
2.7311:1 label — including `conclusion-view.module.css`'s
`.ctaNext`, which wears the **destination** game's accent and therefore
renders on the already-shipped `/binairo`, `/sudoku` and `/nonogram`
conclusions. That is #25's ISS-A2 regression repeated with mustard, on
three screens #27 does not otherwise touch.

## Decision

1. **An accent may colour a shape. The shared accent may never colour a
   word.** Sanctioned accent surfaces: a fill, a washi tape, a hard shadow, a
   rule, a stamp ring, a card border, a graph bar, a board cell. Forbidden
   without exception: **`color: var(--accent)`** — the shared custom property
   the play layer, the conclusion and the hub bind per game — at any size, on
   any paper. That property has no fixed value, so every such declaration is a
   mustard declaration waiting for `playRoutes` to gain `termo`, and there is
   no ratio to measure because there is no one colour. `DESIGN.md:20`'s list
   drops **kicker** and gains this sentence in its place.

   **The exception is a LITERAL accent token whose ratio is measured and
   passes**, and it is arithmetic rather than taste. `color:
   var(--accent-sudoku)`, `var(--accent-binairo)`, `var(--accent-nonogram)`
   and `var(--accent-app)` each name one hex that cannot change under the
   declaration — a single-accent per-game board, control or screen module, or
   the app accent, which is never per game at all. "Which accent is this" has
   one answer, so the contrast is a number. Such a declaration is permitted
   when, and only when, its measured ratio against the paper **actually behind
   it** clears PRODUCT.md's 4.5:1. Thirteen ship today; every one passes and
   consequence (h) lists each with its figure and the paper it was measured
   against. `--accent-app` #9E3B2F is the strongest case: 6.0351:1 on
   `--paper-desk`, 6.2980:1 on `--paper-card`, 5.6253:1 on `--paper-tint` — it
   clears AA on the whole paper family, which is exactly what mustard cannot
   do.

   **`var(--accent-termo)` is inside the exception's shape and outside its
   condition.** 2.8501:1 on card is the ceiling over the whole paper family
   (see Context), so no `color: var(--accent-termo)` on paper can ever satisfy
   the measurement. #27's Termo module may not open one, and a per-game module
   that later serves a second accent loses the exception the moment it does —
   the condition is on the value being fixed AND passing, not on the file
   being per-game.

   The mechanical gate is `apps/web/test/ink-on-accent.test.ts`, whose scan
   reads `var(--accent[a-z-]*)` — every form, not just the shared token — over
   the three shared sheets, with the two `--accent-app` streak declarations
   allow-listed by name and by figure rather than by a hole in the regex
   (consequence (f)).

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
   | `play/screen.module.css` `.titleKicker` | `var(--ink-2)` | 5.0791:1 |
   | `play/screen.module.css` `.barKicker` | `var(--ink-2)` | 5.0791:1 |
   | `play/screen.module.css` `.statLabel` | `var(--ink-2)` | 5.3003:1 |
   | `play/conclusion-view.module.css` `.barKicker` | `var(--ink-2)` | 5.0791:1 |
   | `play/conclusion-view.module.css` `.cardKicker` | `var(--ink-2)` | 5.3003:1 |
   | `play/conclusion-view.module.css` `.stamp` (text) | `var(--ink)` | 15.6663:1 |
   | `play/conclusion-view.module.css` `.chipDone .chipName` | `var(--ink)` | 14.2637:1 |
   | `app/page.module.css:150` `.kicker` | `var(--ink-2)` | 5.3003:1 |
   | `app/page.module.css:222` `.doneChip` (text) | `var(--ink)` | 15.6663:1 |
   | `play/screen.module.css` + `play/conclusion-view.module.css` `.page a:hover` | see decision 4 | 15.0124:1 |

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
   **A future contributor may not cite this line to put a mustard rule under
   a *state-bearing* boundary**: both grounds fail there at once, because a
   state-bearing rule duplicates nothing and its hue *is* the message.

   **The second ground is a condition, not a description, and one site had to
   change to meet it.** `conclusion-view.module.css`'s `.secondaryLink`
   already draws a 2px `border-bottom` at `--line`, so the hover it shipped
   swapped `border-bottom-color` alone: no band appeared where there was none,
   no geometry moved, and the whole state delta was `--line` #D8D0C2
   (L 0.63605722) against mustard — (0.63605722 + 0.05) /
   (0.29477163 + 0.05) = **1.9899:1**. The rule now grows **2px → 3px** on
   hover, and the pixel comes back out of the padding through one custom
   property, so the geometry delta is real and the link's box does not change
   height. The other three accents clear 3:1 against `--line` unaided (sudoku
   5.4727:1, binairo 3.8664:1, nonogram 3.1462:1); mustard at 1.9899:1 is why
   the carrier cannot be the hue (step-7 finding A-F5).

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

8. **A focus indicator is `--ink` wherever one shared sheet serves four
   games, and decision 4's exception can never be stretched to cover one.**
   `screen.module.css`'s `.hint:focus-visible` shipped `2px solid
   var(--accent)` with `outline-offset: 2px`, which puts `--paper-desk` on
   **both** sides of the ring — the offset gap inside it and the page
   background outside — so for mustard it measured **2.7311:1** against WCAG
   1.4.11's 3:1 floor for a focus indicator. It passed only by accident of
   which three games had shipped (nonogram 4.3182:1, binairo 5.3066:1, sudoku
   7.5113:1) and #27, the very trigger this ADR exists for, would have made a
   keyboard user's ring fail on `/termo`. It is now `--ink` #211D19 —
   **15.0124:1** on desk paper, for all four at once — which is the rule
   `nonogram-board.module.css:444-446` already shipped for its own `.control`
   (step-7 finding A-F1).

   The distinction from decision 4 is that exception's own first ground:
   hover is a pointer-only affordance duplicating what the control already
   says at 15.0124:1, whereas a focus ring **is** what the control says, and
   2.4.7 requires it. There is nothing for it to duplicate.

   **The per-game focus rings are left alone, measured and passing** — each
   renders exactly one accent, so decision 1's exception covers them:

   | site | on | ratio |
   |---|---|---|
   | `sudoku-board.module.css:195-199` `.cellSelected, .cell:focus-visible` | `--paper-desk` | 7.5113:1 |
   | — the same ring on a given cell | `--paper-tint` | 7.0012:1 |
   | — the same ring on a hinted cell (10 % ink-blue over desk, #E3E2DE) | composite | 6.4612:1 |
   | `sudoku-board.module.css:313` `.keypadDigit:focus-visible` | `--paper-card` | 7.8385:1 |
   | `sudoku-board.module.css:360` `.keypadErase:focus-visible` | `--paper-card` | 7.8385:1 |
   | `binairo-screen.module.css:70` `.cell:focus-visible` | `--paper-desk` | 5.3066:1 |
   | — the same ring on a given cell | `--paper-tint` | 4.9462:1 |
   | — the same ring on a hinted cell (10 % moss over desk, #E6E5DA) | composite | 4.6733:1 |
   | `binairo-screen.module.css:145` `.control:focus-visible` | `--paper-card` | 5.5377:1 |

   `nonogram-board.module.css:399` and `:444` are already `--ink` and were the
   precedent: `:444`'s `.control:focus-visible` is offset outward onto desk
   paper at **15.0124:1**, and `:399`'s inset cell caret is **15.0124:1** on an
   empty cell and **3.4765:1** on a filled one — solid terracotta — which is
   why that board's caret could never have been the accent at all (1:1 on the
   very cells the player is working, plan 020 P26).

9. **The hover language forks by what the sheet can render, and the fork is
   recorded rather than harmonised.** Three treatments ship and all three
   pass AA:

   - the two **shared** sheets take decision 4's treatment — `--ink` word,
     accent underline or accent rule — because `var(--accent)` there can be
     mustard and no ratio can be measured for it;
   - `app/globals.css:24`'s `a:hover { color: var(--accent-app) }`, the hub's
     and every non-play page's, stays a colour swap at **6.0351:1** on desk
     paper;
   - `components/daily-unavailable.module.css:17`'s `.page a:hover { color:
     var(--accent-binairo) }` stays a colour swap at **5.3066:1**.

   The last two are literal tokens under decision 1's exception, so the fork
   is the exception behaving as written rather than drift. Harmonising them
   was considered and declined: it would repaint two screens that carry no
   defect to satisfy a consistency argument the arithmetic does not require,
   and consequence (a) already asks Fernando to look at three deliberate
   repaints. If `daily-unavailable` ever serves a second game — it hardcodes
   binairo today — it loses the exception together with its literal (step-7
   finding A-F8).

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
- **A per-game *selected ink* returned from `accentVars`, keeping the stamp
  one-toned.** The mechanism already exists — `--ink-on-accent` is exactly
  this shape: a property whose value is chosen per game and read through one
  declaration. A sibling `--ink-on-paper`, resolving to `var(--accent)` for
  sudoku, nonogram and binairo and to `var(--ink)` for termo, would have left
  `.stamp`, `.doneChip` and both kickers **byte-identical on the three shipped
  games** and moved only Termo, and the conclusion's stamp would have stayed
  the single ink `f5-conclusao-desktop.dc.html:29` draws instead of becoming
  two-toned (accent ring, ink text). It was not weighed when the two-tone
  stamp was chosen, and the record should show that it was (step-7 finding
  A-F9). It is declined for three reasons, and "we already shipped it" is not
  among them. **First, it is the `--accent-text` token above wearing a
  property name** — the same third mechanism, with the same per-game
  proliferation, and decision 1 replaces both with a *placement* rule that
  needs no token at all. **Second, it makes the rule unstateable.** "An accent
  may colour a shape, never a word" is one sentence a designer can hold;
  "an accent may colour a word when this property says so for this game" is a
  lookup table, and `DESIGN.md`, `PRODUCT.md` and the native clients would
  each have to carry it. **Third, it preserves exactly what mustard exposed** —
  a system whose legality depends on which game is rendering — where decision
  1 removes that dependency for the shared sheets outright. The cost is
  accepted and named: three stamps and three done-chips repaint, which is
  consequence (a)'s subject and a thing the PR body puts in front of Fernando.
  The two-tone stamp is defensible on its own terms — the ring is decoration
  under decision 5 at 2.8501:1 and the words it encloses are 15.6663:1 — and
  `DESIGN.md`'s stamp spec constrains its *shape* (3px circle, −6deg,
  typographic content only), not the number of inks in it.

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
- **(d) The identity argument survives the colour leaving — but only if the
  typography actually does the work the argument assigns it.** `PRODUCT.md`
  principle 1 — *"Typography is the protagonist. Hierarchy, warmth and
  identity come from Fraunces + Instrument Sans, not from ornament"* — is
  what makes an 11px uppercase **0.16em weight-600** kicker still a kicker in
  `--ink-2`. The accent stays on the tape, the shadow, the stamp ring, the
  fill and the board, which is more accent surface per screen than the kicker
  ever was.

  **This sentence was false for `.barKicker` when it was first written.** Both
  shared `.barKicker` rules shipped 11px/**400**/**0.14em**, which is every
  property of `conclusion-view.module.css`'s `.dayCardTitle` — a *generic
  section eyebrow*, which `DESIGN.md`'s typography section says a kicker
  explicitly is not. At ≤1140px `.titleKicker` and `.cardKicker` are
  `display: none`, so `.barKicker` is the **only** carrier of game identity on
  the primary form factor, and the accent had been the sole thing telling the
  two apart. Both now take `font: var(--text-kicker)` (600) at 0.16em,
  matching `.titleKicker` and `.cardKicker`, so the kicker keeps one character
  across the 1140 fold and across `/<jogo>` → `/<jogo>/concluido` (step-7
  finding A-F6). Pinned by `apps/web/test/ink-on-accent.test.ts`, from both
  sides: the kicker is branded and the eyebrow stays plain.
- **(e) The native clients inherit a token set with a stated placement
  rule**, rather than four hexes and a screen to copy. #68's closing
  sentence asked for exactly this: *"Should land before the native clients
  inherit the token set."*
- **(f) `impeccable detect` cannot see any of this and never will, so every
  decision here is gated by one test file or by nothing.** `low-contrast` and
  `cream-palette` are wildcard-ignored on every host CI scans
  (`.impeccable/config.json:19-39`,
  [#51](https://github.com/fernandolisboa/miolos/issues/51)); a green
  `detect` run is not evidence for a single figure in this ADR.
  `apps/web/test/ink-on-accent.test.ts` asserts stylesheet TEXT — jsdom
  resolves no custom-property fallback chain and composites no colour — and it
  gates decisions 1, 2, 3, 4 and 8:

  | decision | assertion |
  |---|---|
  | 1 | the scan for `color: var(--accent[a-z-]*)` over the three shared sheets, with the two `--accent-app` streak lines allow-listed **by name**, plus a second test keeping that allow-list non-vacuous |
  | 2 | `accentVars` per game, and the per-site `var(--ink-on-accent, …)` fallbacks |
  | 3 | the converted sites, each pinned to its neutral ink |
  | 4 | the hover pair on both sheets, the `(0,3,0)` opt-outs, and `.secondaryLink`'s 2px → 3px geometry delta |
  | 8 | `.hint:focus-visible` is `2px solid var(--ink)` |

  **The scan's original form was `var\(--accent\)` with a literal closing
  paren, and that was a hole, not a gate.** It could not see
  `var(--accent-app)`, `var(--accent-termo)` or `var(--accent-binairo)`, so
  `app/page.module.css` — on the scan's own shared list — passed while
  carrying two accent-coloured declarations, and the assertion's title was
  already false the day it landed. #27's Termo module is precisely the file
  that would have followed them through. It now reads
  `var\(--accent[a-z-]*\)` (step-7 finding A-F3). There is still no automated
  gate on decisions 5, 6, 7 or 9, and none on any per-game module — those rest
  on this ADR and on review.
- **(g) The accent inventory was swept for `color:`, `border:` and
  `background:` declarations only.** A `fill:`, a `stroke:`, a
  `text-decoration-color:` or a `caret-color:` carrying `var(--accent)`
  would not have been found. `conclusion-view.module.css`'s `.picture` carries
  `fill: var(--accent)`, which is a *shape* and is correct under decision 1;
  no exhaustive sweep for others has happened, and this ADR does not claim
  one. The `color:` half **is** now exhaustive for the three shared sheets,
  because (f)'s scan is a scan rather than a list; outside them it is the
  hand-built inventory in (h).
- **(h) Thirteen `color:` declarations name an accent and stay, each measured
  against the paper actually behind it.** This is decision 1's exception in
  full, and the enumeration lives here rather than in a code comment, where
  the copy that used to sit in `ink-on-accent.test.ts` said "five", named
  four, and omitted Binairo's four entirely (step-7 findings A-F2, A-F7).
  Every figure below was recomputed with the WCAG 2.x formula on this branch;
  composited tints are rounded to 8-bit before their luminance is taken,
  because that is what a browser paints (step-7 finding A-F10).

  | # | site | value | on | ratio |
  |---|---|---|---|---|
  | 1 | `sudoku-board.module.css:155` `.cellEntered` | `--accent` → ink-blue | `--paper-desk` | **7.5113:1** |
  | 2 | `sudoku-board.module.css:165` `.cellHinted` | `--accent` → ink-blue | 10 % ink-blue over desk, #E3E2DE | **6.4612:1** |
  | 3 | `sudoku-board.module.css:177` `.cellViolating` | `--accent-app` | `--paper-desk` | **6.0351:1** |
  | 4 | `sudoku-board.module.css:249` `.keypadDigit` | `--accent` → ink-blue | `--paper-card` | **7.8385:1** |
  | 5 | `binairo-screen.module.css:83` `.cellEntered` | `--accent-binairo` | `--paper-desk` | **5.3066:1** |
  | 6 | `binairo-screen.module.css:105` `.cellViolating` | `--accent-app` | `--paper-desk` | **6.0351:1** |
  | 7 | `binairo-screen.module.css:114` `.cellHinted` | `--accent-binairo` | 10 % moss over desk, #E6E5DA | **4.6733:1** |
  | 8 | `binairo-screen.module.css:154` `.controlDigit` | `--accent-binairo` | `--paper-card` | **5.5377:1** |
  | 9 | `nonogram-board.module.css:426` `.control` | `--accent` → terracotta | `--paper-card` | **4.5063:1** |
  | 10 | `components/daily-unavailable.module.css:17` `.page a:hover` | `--accent-binairo` | `--paper-desk` | **5.3066:1** |
  | 11 | `app/globals.css:24` `a:hover` | `--accent-app` | `--paper-desk` | **6.0351:1** |
  | 12 | `app/page.module.css:65` `.streakNumeral` | `--accent-app` | `--paper-desk` | **6.0351:1** |
  | 13 | `app/page.module.css:73` `.streakLabel` | `--accent-app` | `--paper-desk` | **6.0351:1** |

  Rows 1, 2, 4 and 9 read `var(--accent)`, but in a **per-game board module**
  whose screen root binds it to one token and only one — `sudoku-screen` to
  ink-blue, `nonogram-screen` to terracotta — so the value is fixed at the
  site even though the syntax is the shared one. That is why they satisfy
  decision 1's exception and the same syntax in a shared sheet does not.

  **The worst of the thirteen is 4.5063:1**, clear of PRODUCT.md's 4.5 floor
  by 0.0063. Nothing here has headroom to spare: a token nudge, a paper
  change or a fifth game reusing one of these modules re-opens the
  measurement, and this table is the thing to recompute rather than trust.
