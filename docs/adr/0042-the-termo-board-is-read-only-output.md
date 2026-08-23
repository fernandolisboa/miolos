# ADR-0042 — The Termo board is read-only output; the keyboard is the interactive surface

**Status:** Accepted — 2026-08-02
**Depends on:** [ADR-0018](./0018-i18n-is-an-in-repo-typed-message-module.md), [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md), [ADR-0030](./0030-grid-games-are-composite-widgets-one-tab-stop-roving-focus.md), [ADR-0034](./0034-the-completion-celebration-renders-in-the-conclusion.md), [ADR-0037](./0037-the-nonogram-board-is-a-three-state-brush-board.md), [ADR-0041](./0041-accents-colour-shapes-never-words.md)
**Amended by:** [ADR-0067](./0067-termo-accent-deepens-to-carry-a-light-label.md) (#161) — `--accent-termo` deepened `#C08A1E` → `#8D6212`, so the state table's `correct` row reads `var(--ink-on-accent, var(--paper-desk))` at **4.8433:1** (the mustard figures 2.7311 / 2.8501 / 5.4968 in this file are the old value's). Everything this ADR decides survives: the board stays read-only, the accent still does exactly one job (the `correct` fill), the typographic marks still carry every distinction, and the chroma argument holds at the new value (chroma 123 ≥ 30).

## Context

[ADR-0030](./0030-grid-games-are-composite-widgets-one-tab-stop-roving-focus.md)
settled the keyboard architecture for **grid games** — one tab stop, roving
focus, `role="group"`, no `role="grid"` — and its consequence (a) names the
inheritors as *"#25's Nonogram board and #28's free play"*, on the ground
that both are grid games with a selectable cell.

**A Termo board is neither.** Six rows of five tiles, fixed size, read-only
until submitted, with no per-cell selection, no caret to rove and nothing
to write into. Handoff 019 §7 and 021 §4.4 both say so: *"the natural
answer is that the keyboard is the interactive surface and the tile board
is `role="group"` output."* So the model is a fresh decision, and it
inherits ADR-0030's *reasoning* — scale, honest roles, state in the
composed name — rather than its decisions.

Two facts about the palette decide the visual half. Under
[ADR-0041](./0041-accents-colour-shapes-never-words.md) mustard may not be
text. And at **2.7311:1** on `--paper-desk` and **2.8501:1** on
`--paper-card` it also misses WCAG 1.4.11's 3:1 floor, so it may not be a
state-bearing boundary either. A board whose entire content is three
colour-coded states therefore cannot encode them in colour. It has to
encode them in **type**, which is what `PRODUCT.md` principle 1 asks of
this system anyway.

There is no reference frame for this screen. `/termo` is a just-in-time
design in the situation `/nonogram` was in, and
`apps/web/src/nonogram/nonogram-board.module.css`'s header is the template
for recording its deviations with their arithmetic.

## Decision

1. **The tile board is `role="group"` OUTPUT. Nothing on it is focusable.**
   Not `role="grid"` — the argument is stronger than Sudoku's, because a
   grid promises keyboard navigation over cells and these cells are not
   navigable at all. Each of the six rows is its own labelled
   `role="group"`, and the row's whole judged sentence is **composed in
   `messages.ts`**
   ([ADR-0018](./0018-i18n-is-an-in-repo-typed-message-module.md), ADR-0037
   decision 3): five one-letter spans would otherwise concatenate to
   `"CAFES"` with no states, the same defect as `2 2 2 2 3` reading
   `"22223"`. The tiles inside a row are `aria-hidden`, so **the row's
   composed name is the row's only accessible content** — which makes it
   load-bearing on the **active** row, not only on judged ones. A *judged*
   row's name carries every letter **and** its verdict; the **active** row's
   name carries the **draft**: the letters typed so far and how many slots
   remain. Getting that second half wrong is not a nicety — with the tiles
   hidden, an unannounced draft leaves a screen-reader user with no signal
   whatsoever between the first keypress and `enviar`: no confirmation, no
   read-back, nothing from `apagar`. So the draft is also spoken: the
   `.announcer` region (decision 10) carries it on every type and erase, not
   only the judged sentence. Unhidden tiles stay refused — they make a
   screen reader read the word twice, the second time ungraded. There is no
   `<div>` carrying only `aria-label` anywhere on this board.

   The rows are **real flex row boxes**, never `display: contents`. A
   `role`-bearing element with `display: contents` has a long, documented
   history of being dropped from the accessibility tree (ADR-0030's
   Rejected list), and here there is no reason to risk it: every tile is a
   fixed square, so rows cost nothing geometrically. ADR-0035's "never a
   wrapper element" rule protects a single flat grid whose *tracks* compute
   the geometry, and does not transfer.

2. **The on-screen keyboard is a composite widget** — a labelled
   `role="group"`, every key a `<button type="button">`, exactly one
   carrying `tabindex="0"` (the last-focused key, `Q` at first paint), so
   the whole keyboard is **one tab stop** rather than 28. This is
   ADR-0030's model **narrowed**: there is no selection, so `onFocus`
   writes only a remembered focus and no layout effect closes any loop. Key
   table: `←`/`→` move within the row and **clamp**; `↑`/`↓` move between
   rows, clamping the column index into the shorter row; `Home`/`End` go to
   the row's first/last key; `Enter`/`Space` are native button activation.
   Arrows `preventDefault`.

3. **Keys are COMMANDS, not modes: no `aria-pressed`.**
   `apps/web/src/sudoku/keypad.tsx:15-20`'s rule, verbatim. A key writes a
   letter; it has no mode to be in. Its judged state is a fact about the
   game and rides in the composed accessible name — ADR-0030 decision 7's
   rule — so `aria-label` is `letra A` before judging and `letra A: fora`
   after.

4. **The physical-keyboard listener is `window`-scoped, in the screen's own
   effect, and it serves the UNFOCUSED page.** **This is not a divergence
   from ADR-0030 and no amendment is owed:** that ADR's decision 1 is scoped
   *"A **grid game's** board is a composite widget from #23 onward"* and its
   consequence (a) enumerates the inheritors as *"#25's Nonogram board and
   #28's free play"* — both quotes read from
   [ADR-0030](./0030-grid-games-are-composite-widgets-one-tab-stop-roving-focus.md)
   in full. A Termo board is neither, so decision 3's *"one listener on the
   board container"* is scoped to grid boards, does not reach here, and
   there is nothing to diverge from. The window listener is a **fresh
   decision**, taken for a structural reason: a grid game's caret lives
   inside its board, so the container is the focused element by
   construction; a Termo player expects to type the instant the page paints,
   without clicking anything, and a container listener would be dead until
   something took focus.

   **Because it serves the unfocused page, it must stand down the moment
   anything IS focused.** Guards, in order: `status !== "playing"`; any of
   `metaKey`/`ctrlKey`/`altKey`; a target matching `input, textarea,
   [contenteditable]`; **and a target matching `button, a[href],
   [role="button"], [tabindex]`, or sitting inside the keyboard container.**
   That last guard is not defensive tidiness. Without it, a focused key
   receiving `Enter` is handled **twice** — the window listener submits and
   the browser's synthesised click types a letter; `Enter` on a focused
   `enviar` double-submits; and `Enter` on the "← Hoje" link submits a guess
   while navigating away, spending a turn. Worse, it is the *normal* path
   for assistive technology: NVDA and JAWS stay in browse mode on a button
   and activate it with `Enter`, so without the bail a screen-reader user
   submits a guess after every single letter and the game is unplayable.
   Then `Enter` submits,
   `Backspace` deletes with `preventDefault` (it is a history-back gesture
   in some browsers), and any other key is accepted when
   **`normalizeWord(event.key)` matches `/^[a-z]$/`** — so an ABNT2 player
   who types `á` or `ç` out of habit gets `a` and `c` rather than a dead
   key. AC 2's *"accent-free input matches accent-insensitively"* is applied
   to the keystroke, not only to the comparison, and it reuses the engine's
   one normalization function rather than adding a second. Window-scoped
   listeners are established practice in this layer
   (`use-play-lifecycle.ts` — `pagehide` and `pageshow`; its
   `visibilitychange` is `document`-scoped — and `use-pointer-stroke.ts`'s
   `armWindowEnd`).

5. **The SIX tile states are encoded in TYPE, and mustard does exactly one
   job: it fills the `correct` tile.** Every distinction a player must make
   is carried by a mark that clears 3:1 in neutral ink; the accent is
   identity and reinforcement, never the sole carrier of anything.

   | state | fill | border 1.5px | glyph | mark |
   |---|---|---|---|---|
   | empty | `--paper-desk` | `--line` | — | — |
   | typed | `--paper-desk` | `--ink-2` (5.0791:1) | `--ink` | — |
   | **held** | `--paper-desk` | `--ink-2` **dashed** (5.0791:1) | `--ink` | — |
   | caret | `--paper-desk` | `--line` | — | `outline: 2px solid var(--ink)`, offset −2px (15.0124:1) |
   | **absent** | `--paper-tint` | `--line-soft` | `--ink-2` (4.7342:1) | **`line-through`**, **`--ink`**, 2px (13.9929:1 on the tint) |
   | **present** | `--paper-desk` | `--ink` (15.0124:1) | `--ink` (15.0124:1) | **`underline`**, `--ink`, 3px (15.0124:1) |
   | **correct** | **`var(--accent)`** | `--ink` | `var(--ink-on-accent, var(--ink))` (**5.4968:1**) | — |

   **`held` is the sixth**, and it is
   [ADR-0039](./0039-termo-cannot-be-played-offline.md) consequence (g)'s —
   *"a sixth tile appearance beside empty, typed, caret, and the three
   judged states"* — discharged in plan 022 §12.2 and §12.6, which this ADR
   names rather than restates. Its carrier is a **shape** difference from
   `typed` (solid → dashed), so it owes no ratio of its own; `border-style`
   is not animatable, so it snaps at every motion setting and owes no
   reduced-motion rule either. An earlier draft of this decision counted
   **five** states and omitted it.

   **`absent`'s strike is drawn in `--ink`, not in the glyph's own
   `--ink-2`, and that is a correction.** Same-colour mark and glyph is
   **1.0000:1**: on every letterform with a horizontal midstroke the strike
   merges into the glyph and `A` reads as `Ⱥ` rather than as a struck `A`.
   `--ink` gives **13.9929:1** against the tint the mark is drawn on — the
   1.4.11 figure that governs — and **2.9557:1** against the `--ink-2` glyph
   it crosses, a plainly darker rule over a lighter letter.
   [ADR-0041](./0041-accents-colour-shapes-never-words.md) is not reopened
   by this: that ADR governs the **accent**, and `--ink` / `--ink-2` are
   neutrals whose relationship the design system already fixes. The same
   change applies to the keyboard's `.keyAbsent`.

   In greyscale — the **luminance-equivalent** grey, i.e. the 8-bit sRGB
   value with the same relative luminance, which is the figure ADR-0041
   decision 2 also quotes for mustard; a naive Rec.601/709 luma over the
   gamma-encoded channels gives 142 for `--accent-termo` and is the wrong
   quantity for a "does this read dark" claim, so do not re-derive it that
   way — `--accent-termo` 148, `--paper-desk` 242, `--paper-tint`
   235, `--ink` 30, `--ink-2` 103, `--line` 209, `--line-soft` 221 —
   `correct` is the only dark tile, `present` is a white tile with a heavy
   rule under a black letter inside a black frame, and `absent` is a paler
   tile with a mid-grey letter struck through inside a frame that barely
   registers. Three unmistakable readings with no hue involved, which is
   also the colour-blindness answer. A mustard *fill* is a sanctioned accent
   surface under [ADR-0041](./0041-accents-colour-shapes-never-words.md)
   decision 1 precisely because it is a shape and not a word.

   The caret is the repo's shipped inset-outline idiom
   (`sudoku-board.module.css:195-199`, `nonogram-board.module.css:398-402`)
   reused as a **pure state class**, because nothing here is focusable and
   `:focus-visible` can never match. It is **static** — a blinking caret is
   exactly `pulsing-dot`'s and `blinking-cursor`'s shape.

6. **Geometry, with the arithmetic.** Board: 52px tiles / 4px gaps above
   768px (`DESIGN.md:50` verbatim — Termo is the first board narrow enough
   to honour it exactly), 44px / 3px below, one recorded deviation from
   `DESIGN.md:50`'s 38px mobile cell because a 5-column board at 38px is
   202px inside a 350px field. Card 310×366 desktop, 254×301 mobile;
   `--board-mobile-max: 254px`, **declared unconditionally**, because
   `play/screen.module.css:490` reads it with no fallback and omitting it
   deletes the ≤768px cap in silence. (That line is `:490` in tree, not the
   `:409` one shipped comment still cites — `screen.module.css:290`; the
   `accent.ts` copy went with #205's sweep.) Keyboard: one 20-column grid, letter
   keys span 2 and command keys span 3, `width: 552px` / `gap: 8px` / rows
   52px on desktop → `C = (552 − 19×8)/20 = 20px`, a 48px letter key and a
   76px command key; `max-width: 350px` / `gap: 4px` / rows 48px below 768px
   → `C = 13.7px`, a 31.4px letter key at 390 and **24.4px at 320**. The
   keyboard, not the board, is the widest thing in `.board`: 552px against
   the 578px the shared 1140px fold leaves (`1140 − 2×80 − 330 − 72`),
   **26px of margin**. Every number here is computed from the shipped
   stylesheets, not measured in a browser; jsdom implements no layout.

7. **Board and keyboard touch targets fall below 44px, this is conscious,
   and it is recorded HERE rather than only in a stylesheet comment.**
   `10 × 44 = 440px` exceeds the 350px available at the reference phone
   **before any gap**, so `PRODUCT.md:39` / `DESIGN.md:40`'s ≥44px is
   arithmetically unreachable on the horizontal axis for a 26-letter
   keyboard. WCAG 2.5.8's 24×24 floor is cleared at every width the repo
   designs for — 31.4 × 48 at 390px, **24.4 × 48 at 320px** — and the
   vertical axis is held above 44px because it is free. **WCAG
   2.5.5/2.5.8's essential-presentation exception applies: an alphabet is
   26 keys, and a keyboard whose keys are 44px wide is not a keyboard on a
   phone.** This is ADR-0035 decision 7's argument, inherited rather than
   re-derived, and it is the second time the repo has met the same wall.

8. **There is no Ç key.** `packages/games/src/termo/evaluate.ts:13,17`
   builds the guess shape as `^[a-z]{5}$` from `WORD_LENGTH`, and
   `normalizeWord` maps `ç → c` before anything is compared, so a Ç key
   would write the same letter as C and `deriveKeyboardState`
   (`packages/games/src/termo/keyboard.ts:23`) — which keys on the
   normalized letter — could never colour it differently. A key that
   duplicates another and can never carry its own state is a trap, not an
   affordance. The rows are 10 / 9 / 7 + 2 commands.

9. **Nothing on this screen is a `@keyframes` animation.** The row reveal
   is a `transition` on paint properties over `var(--duration-fast)`,
   staggered 60ms per column via `transition-delay` on the judged classes,
   so a row settles in `150 + 4×60 = 390ms`. That is ADR-0034 decision 2's
   permitted per-entry paint feedback and **must not be described as the
   celebration** in a PR, a comment or a ticket. A rejected guess produces
   **no motion and no colour change at all** — the visible `role="status"`
   line carries it (`PRODUCT.md` principle 4: *"nothing nags"*). Termo's
   module carries its own `prefers-reduced-motion` block, and it stands down
   the **stagger** as well as the transition, or a reduced-motion user waits
   390ms for a paint that no longer animates.

10. **Two live regions, both `role="status"`, and the disjointness claim is
    narrowed to what is actually true.** A visible `.notice` in a
    permanently reserved box under the board carries **"não está na lista"**
    verbatim (AC 3) and the held/rejected lines, and nothing else; a
    visually hidden `.announcer` carries the judged row's composed sentence
    **and the draft** (decision 1). An earlier draft claimed the two *"can
    never speak in the same tick"* because a guess is either rejected or
    judged. Extending the announcer to the draft makes that false as stated,
    and so does a held turn that succeeds on retry. The true claim is
    narrower and is a **rule** rather than an accident, and it is stated as
    **disjoint writers**: `announcement` is written **only** by `type`,
    `erase` and `judged`; `notice` is written **only** by `submit` and
    `retry` (which clear it) and by the failure branches (which set it).
    **No single transition writes both**, so the two regions can never
    mutate in the same commit.

    **The clear is therefore gated on `submit`/`retry` — not on `judged`,
    and not on the next keystroke.** Both of those placements look natural
    and both break the rule: clearing on `judged` makes the
    retry-succeeds transition write the row sentence *and* blank the
    connection line at once, which is exactly the two-regions-in-one-commit
    race; clearing on the next `type` collides with the letter
    announcement. Gating at `submit` also reads better — a rejection stays
    under the board for as long as the player is fixing the word. *(An
    earlier draft of this decision said "any transition that writes
    `announcement` clears `notice` in the same reducer transition"; that is
    the placement this paragraph rejects, and it is withdrawn.)* The proof
    is a **walk over every action** of the reducer asserting that at most
    one of `{notice, announcement}` differs from the previous state — a
    happy-path test proves nothing here, because the collision is on the
    retry path. Whether two regions then queue rather than race is not
    provable in jsdom and is not claimed here (consequence (e)).

    **A second identical rejection needs a deliberate mutation to be
    audible.** `role="status"` is implicitly `aria-atomic`, and React does
    not touch a text node it is rewriting identically, so a player who
    submits the same invalid word twice hears silence the second time on
    the one channel telling them why the board is not moving. The region
    therefore carries a sibling span holding a zero-width character on odd
    notice writes and the empty string on even ones, driven by a nonce
    incremented on **every** write to `notice` including a write of the
    string already there. It is a sibling, never appended to the notice's
    own text node, so a `getByText("não está na lista")` still matches
    exactly. Plan 022 §13.1b carries the mechanism.

    **The terminal sentence is deliberately not announced by this
    component**: the play view unmounts one frame after the board closes
    (ADR-0034 consequence (a), measured at 11.7 ms median), so an
    announcement from here would be cut off. **The conclusion owns it, and
    that is now a mechanism rather than a hope**: `conclusion-view.tsx` as
    shipped has no live region and no focus management at all — read in
    full, its single `useEffect` (`:89-95`) starts the completion sync and
    nothing else — so on the in-place swap focus falls to `<body>` and a
    blind player hears nothing at the product's payoff moment.
    [ADR-0043](./0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md)
    decision 10 closes that by putting a `role="status"` on the conclusion
    carrying `ConclusionOutcome.aria`. Focus still never moves
    programmatically on either screen, and `aria-invalid` is used nowhere —
    ARIA does not support it on `role=button` and
    `jsx-a11y/role-supports-aria-props` reds the lint gate (ADR-0030
    decision 7).

## Rejected

- **The Wordle tile flip.** A 3D `rotateX` reveal is not "ink that
  settles"; a staggered flip runs ~600ms against `DESIGN.md:44`'s
  150–250ms window; it needs `@keyframes`, which re-arms `bounce-easing`'s
  name gate for nothing; and it would be a second motion language on a
  screen whose only other motion is the press.
- **A shake on an invalid word.** `shake` does not match
  `/bounce|elastic|wobble|jiggle|spring/i`, and that is not permission —
  `wobble` and `jiggle` being banned says what the system thinks of the
  gesture. The rejection is carried by copy, in two places, and nothing
  moves.
- **Mustard for the `present` state, as a ring or as an inset foot-band.**
  At 2.7311:1 it is a state-bearing boundary below WCAG 1.4.11's 3:1 —
  [ADR-0041](./0041-accents-colour-shapes-never-words.md) decision 5's
  line. The band form is additionally a live `side-tab` finding:
  impeccable's inset-stripe scanner (`checks.mjs:963-1018`) fires on an
  inset layer with blur 0, spread 0, a 3–12px single-axis offset and
  **chroma ≥ 30**, and mustard's chroma is 162. `--ink`'s is 8, which is
  why the neutral answer is also the compliant one.
- **`border-bottom: 6px solid var(--accent)` for the same band.** Fires
  `border-accent-on-rounded` (`checks.mjs:57`): dominant edge, chromatic,
  `radius > 0`, `w >= 2`.
- **`--paper-tint` as `absent`'s only carrier.** `--paper-tint` against
  `--paper-desk` is **1.0729:1** — 235 against 242 in greyscale. Invisible.
  Named here so a later "simplification" cannot drop the strike and keep
  the tint.
- **The `--ink` / `--ink-2` glyph step as a sufficient carrier.**
  **2.9557:1** — below 3:1. It is a reinforcement, never the mechanism.
- **Green / yellow / grey.** Two new hues in a system whose rule is one
  accent per game (`DESIGN.md:20`). ADR-0041 decision 6 does not forbid it
  by name — that decision freezes the four accent *values* — but it is the
  same palette-change move Fernando declined on 2026-08-02, and reopening
  it needs its own ADR rather than a stylesheet.
- **The board as a composite widget with roving focus over 30 tiles.** It
  would promise navigation of a surface that accepts no input, and would
  give the screen two keyboard models where one suffices.
- **Ordinary tab stops on the 28 keys.** Binairo's 64-stop problem at a
  smaller scale: every keyboard user would pay 28 presses to reach the
  chrome.
- **`aria-pressed` on the keys.** ADR-0037 decision 1 uses it for the
  Nonogram brush *because the brush is state a stroke reads*. A Termo key
  is a command whose value is its own letter — Sudoku's case, not
  Nonogram's.
- **A container-scoped `keydown` listener** (ADR-0030 decision 3's shape).
  Dead until something inside the board takes focus, on a board where
  nothing can.
- **Putting the canonical accented spelling on the winning board row.** It
  overwrites the player's own accent-free input; the reveal belongs to the
  conclusion
  ([ADR-0043](./0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md)
  decision 5).

## Consequences

- **(a) `packages/games/src/termo`'s model half ships unchanged.**
  `deriveKeyboardState`, `evaluateGuess`, `deriveBoardStatus` and
  `isValidGuess` are pure and already correct; this ADR decides only the
  view. The one thing #27 adds on the client side is a per-key class from
  `KeyboardState` and a per-tile class from `TileStates`.
- **(b) `/termo` is the first screen whose widest element is not its
  board.** The keyboard is 552px against the board card's 310px, so the
  ≤768px `--board-mobile-max` cap governs only the card and the keyboard
  carries its own literal 350px cap. A later contributor who "unifies" the
  two caps shrinks the keyboard to 254px and puts 24 letter keys in 254px.
- **(c) The stats card has ONE row, not three.** Sudoku has `Nível` and
  Nonogram has `Tamanho` because both have a per-day parameter on the wire;
  Termo's public projection is `game, date` only
  ([ADR-0040](./0040-the-termo-daily-stores-the-drawn-answer.md)), so there
  is nothing honest to put there — and
  [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md)
  decision 4 removes the timer row as well, leaving *Progresso* →
  "tentativa N de 6" alone. (An earlier draft of this consequence said
  "two rows, not three"; it predates ADR-0045 decision 4 and is corrected
  here.) The card is shorter, and that is correct rather than unfinished.
- **(d) #28's free play does not inherit any of this.** ADR-0005 excludes
  Termo from free play — its word list is finite curated content — so this
  board has exactly one consumer and no extraction is owed.
- **(e) The announcement is not provable in jsdom.** The markup is
  assertable — roles, labels, `tabindex`, the composed names, and the
  stylesheet text for the six states — but that a `role="status"` region is
  spoken, that two of them queue rather than race, and that a
  `role="group"` row label is announced instead of its `aria-hidden`
  children, is not. One real VoiceOver/NVDA pass is owed and its result
  recorded; this ADR does not claim it has happened.
- **(f) The `apagar` label's fit at 320px is arithmetic, not
  measurement.** A 3-column key is 38.6px there and `apagar` at 11px
  Instrument Sans 600 is estimated at ≈33.6px of advance; ADR-0036 measured
  only the tabular digit (6.609375px at 11px). 320px is not a CI viewport
  and 390px leaves 7.7px of slack. **The pre-agreed response if the
  rendered label overflows: drop `.keyCommand`'s inline padding to 2px
  inside the ≤360px band — never below the 11px floor, which
  `undersized-ui-text` (`checks.mjs:3439`) enforces unconditionally on
  interactive text.**
- **(g) That `line-through` and `underline` read on a single Fraunces
  glyph is a rendering judgement no harness makes.** Two pre-agreed
  responses if the strike is illegible at the mobile tile size, and the
  **second is the better one**: `text-decoration-thickness: 3px` on the
  absent tile, and/or `text-decoration-color: var(--ink)`.
  `text-decoration-color` defaults to `currentColor`, so as drawn the strike
  is the glyph's own `--ink-2` — **1.0000:1 against the letterform it
  crosses** — and on every glyph with a horizontal midstroke an "A" simply
  reads as "Ⱥ". Moving the strike to `--ink` puts **2.9557:1** between the
  mark and the glyph, which is what makes it read as an overlay rather than
  as part of the letter. **This is explicitly permitted and does not reopen
  [ADR-0041](./0041-accents-colour-shapes-never-words.md)**, whose decision 1
  governs where an **accent** may be placed; `--ink` on `--ink-2` is a
  neutral change it does not touch. What stays forbidden is putting the
  accent on this mark.
