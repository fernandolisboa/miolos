# ADR-0043 — The conclusion has a fourth state, and it is a loss

**Status:** Accepted — 2026-08-02
**Depends on:** [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0028](./0028-daily-play-routes-and-the-conclusion.md), [ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md), [ADR-0033](./0033-the-nonogram-reveal-ships-no-name.md), [ADR-0034](./0034-the-completion-celebration-renders-in-the-conclusion.md), [ADR-0038](./0038-termo-guesses-are-judged-by-a-stateless-server-route.md), [ADR-0042](./0042-the-termo-board-is-read-only-output.md), [ADR-0044](./0044-a-lost-termo-is-played-not-pending.md), [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md)

## Context

`<ConclusionView/>` has three states — `skeleton`, `empty`, `result`
(`apps/web/src/play/conclusion-view.tsx:126`, `:141`, `:188`) — and all
three assume the stamp is an achievement. `stampLabel` is `"Concluído"`;
`stampAria` is *"X concluído em MM:SS, sem dicas"*; the 150px circle's
three slots are a label, a time and a hints line.

Three games have shipped and none of them can lose.
[ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md)
rule 3: *"A lost Termo is played, not completed."* `PlayCore.status` has
carried `"lost"` since day one for exactly this ticket
(`apps/web/src/play/types.ts:31`,
[ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md)
decision 5), with **zero producers**. #27 is the first.

[ADR-0034](./0034-the-completion-celebration-renders-in-the-conclusion.md)
decided where a **celebration** goes and its consequence (b) forecloses
reopening it. It is silent on where a **loss** goes, because nothing in the
product could lose when it was written. Its decision 3 does give the shape
a per-game payload must take — optional plain data, supplied only by a
client component that owns the local play record — and `ConclusionPicture`
is the worked example.

#27's AC 2 adds a second thing the conclusion must carry: *"canonical
accented form revealed at the end."* ADR-0033's Rejected list already
establishes the wrong channel for it, in terms that transfer exactly: the
completion **response** is broken as a reveal carrier because
`acceptResponse` copies only `elapsedMs`/`hintsUsed`, only on the
`recorded: false` branch (`apps/web/src/play/sync.ts:349-358`), and
`settle` writes `{...record, pendingSync, syncOutcome}` (`:362-368`) — so a
word on the response is discarded before a reload could show it, and the
replay path returns before the wall read, so a second visit gets a response
with nothing to name from.

And [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md)
decision 4 removes the clock and the hint line from this game entirely,
handing the stamp's three slots to this ADR on **both** outcomes, not only
the loss.

## Decision

1. **`data-conclusion-state="lost"` is a fourth branch, and ONE new
   optional plain-data prop serves BOTH Termo outcomes.**

   ```ts
   export interface ConclusionOutcome {
     readonly state: "result" | "lost";
     readonly label: string;   // "Concluído" | "Jogado"
     readonly detail: string;  // "4/6" | "X/6"
     readonly aria: string;    // the whole composed name
     readonly settle: boolean; // the shared stamp-settle animation
   }
   ```
   `state` drives `data-conclusion-state`; `label`/`detail` are the stamp's
   two slots; `settle` is `false` on a loss. There is **no separate loss
   type** — an earlier draft carried a loss-only interface beside a second
   win-stamp member, and merging them is what makes a **won** Termo
   impossible to render as `"lost"` by an implementer who gated on the
   prop's presence instead of its `state`. Termo passes this prop on both
   outcomes, because neither of the shipped stamp's three slots is honest
   for this game (decision 5). Supplied only by a client component that owns
   the local play record — on `/termo` by the screen, on `/termo/concluido`
   by the Termo conclusion wrapper, the same two mount points
   `NonogramConclusion` already uses. A game that passes nothing renders
   exactly what it rendered before the prop existed.

   **The attribute's value is the BOARD verb, deliberately, and the day verb
   is not used here.** `data-conclusion-state` is a render-branch marker
   whose existing values are `skeleton`, `empty` and `result` — none of them
   a `CONTEXT.md` day verb either — and it mirrors `ConclusionOutcome.state`,
   which mirrors `TermoBoardStatus`. `CONTEXT.md`'s **Played / Jogado** is
   the *day's* verb, and it is where it belongs: `DayEntry.status: "played"`
   ([ADR-0044](./0044-a-lost-termo-is-played-not-pending.md) decision 4), the
   visible `jogado` chip (decision 9), and the stamp's `label`.
   `packages/games/src/termo/status.ts:5-11` keeps the two apart on purpose
   (*"The name is TermoBoardStatus, not game/day status, to keep that line
   sharp"*), and this attribute stays on the board side of that line.

2. **The loss branch is checked BEFORE the stamp branch**, so it never
   depends on `ConclusionResult`, on `record.concluded`, or on an elapsed
   time: `!hydrated → skeleton`, `outcome?.state === "lost" → lost`,
   `stamp === undefined → empty`, otherwise `result`. Placed after the
   stamp check, a lost Termo — which *is* a locally-concluded record —
   would fall into `result` and render a "Concluído" stamp over a loss.
   **The gate is `outcome?.state === "lost"`, never `outcome !== undefined`**:
   a won Termo passes the prop too, and gating on presence would render
   every Termo win as a loss.

3. **The loss's stamp is the win's, stepped down three ways at once, and
   the third step is the loudest**: a 1.5px ring instead of 3px,
   `var(--ink-2)` instead of the accent (5.3003:1 on `--paper-card`), two
   slots instead of three (`label` and `detail`), and **no `stamp-settle`
   animation** — which is `settle: false`, a field on the prop rather than a
   branch in the component. There is no
   consolation flourish, no second stamp design, no mascot and no emoji.
   **The loss equivalent of the celebration is the celebration's absence**,
   and stating that here is what stops the next contributor from inventing
   one. The big slot reads `X/6` — the genre's own notation, spelled out in
   the composed accessible name as *"Termo jogado: as 6 tentativas acabaram
   sem acerto."*

   **The numeral is a DIGIT, not a spelled word**, in this quote and in
   decision 6's. An earlier draft of both wrote *"as **seis** tentativas"*;
   the shipped composers render `as ${max}` / `As ${max}`
   (`apps/web/src/i18n/messages.ts`), and the rule they follow is the better
   one, stated in that module: *"a composer takes its numbers and renders
   DIGITS; it never spells one in words and never branches on a value it was
   handed"* — `max === 6 ? "seis" : String(max)` would be a runtime branch on
   a compile-time constant whose false arm is unreachable and untestable.
   Screen readers read `6` as *"seis"* in pt-BR, so nothing is lost. The
   quotes here are corrected to the shipped strings so the ADR and the copy
   cannot drift.

4. **No time-as-achievement framing on a loss.** No `.stampTime`, no hints
   line, no `elapsedMs` anywhere in the branch. A time on a game nobody won
   is the same lie `apps/web/src/play/day-state.ts:26-30` already refuses
   for a part-played board.

5. **On a WIN, the Termo stamp shows the guess count where a grid game
   shows a time, and no hints line — through the SAME prop.**
   [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md)
   decisions 3 and 4 make all three of the shipped stamp's slots wrong for
   this game — the clock is not rendered and "sem dicas" would present as a
   virtue something that was never possible — and hand the mechanism here.
   The mechanism is decision 1's prop, not a second one: Termo passes
   `{ state: "result", label: "Concluído", detail: "4/6", aria, settle:
   true }`, and the `result` branch renders `label`/`detail` in place of the
   shipped label/time/hints triple. `ConclusionResult` is **still passed**,
   because the `result` branch gates on it; it carries the real recorded
   `elapsedMs` and `hintsUsed: 0`, and neither is rendered. Three games pass
   nothing and are byte-identical.

6. **The canonical accented spelling renders in the conclusion, on BOTH
   outcomes**, as a second optional plain-data prop:

   ```ts
   export interface ConclusionAnswer {
     readonly result: string;    // "Você acertou em 4 de 6 tentativas." | "As 6 tentativas acabaram."
     readonly lead: string;      // "A palavra de hoje era"
     readonly canonical: string; // "café"
   }
   ```
   On a win it is not redundant: the player typed the word accent-free and
   the accents are the thing they have not seen. It is unanimated,
   deliberately — a third settle would make the card busy on a win and
   would be the only motion on the screen on a loss, which reads as
   celebrating one. It carries no background, border, radius or box-shadow,
   so `isCardLikeFromProps` (`checks.mjs:227-230`) returns false on its
   first guard and `nested-cards` cannot fire — `.picture`'s recorded
   argument, reused.

7. **The canonical form reaches the client on the guess/judge response at
   the moment the board closes, and is persisted in the Termo play
   record.** That is
   [ADR-0038](./0038-termo-guesses-are-judged-by-a-stateless-server-route.md)
   decision 2's `answer`-iff-closed refine and
   [ADR-0044](./0044-a-lost-termo-is-played-not-pending.md) decision 2's
   record field. Never on the completion response (the channel ADR-0033
   already rejected, for reasons that transfer verbatim), and never from
   the server segment — `/termo/concluido` renders for players who have not
   finished, so a server-computed answer would turn a bookmarkable page
   into a spoiler channel (ADR-0034 decision 3's second rule, ADR-0004).

8. **`ConclusionCopy` is not widened.** It stays
   `{title, kicker, notYet:{title, cta}}`. Every string in
   `ConclusionOutcome` and `ConclusionAnswer` — including `aria`, the whole
   composed accessible name — is composed by the Termo wrapper from
   `messages.ts` and handed across as a finished string.
   `apps/web/src/play/types.ts:73-83`'s rule holds: **plain data
   only, never a function, however tempting** — a function crossing the RSC
   boundary is an HTTP 500 that only `test/route-ssr.test.tsx` can see, and
   #23 shipped exactly that bug in exactly this file.

9. **A played-but-not-completed game reads `jogado` on the day card, and
   the chaining CTA skips it.** The data shape is
   [ADR-0044](./0044-a-lost-termo-is-played-not-pending.md) decisions 4 and
   5 — `DayEntry.status: "pending" | "completed" | "played"`, `elapsedMs`
   never set unless `"completed"` (ADR-0044 decision 4, as qualified there),
   `completedCount` counting `"completed"` only, and `nextPendingDaily`
   chaining on `"pending"` only. What this ADR decides is the rendering:
   `DayChip`'s shipped pair of values (a duration, or `falta`) grows, and
   `.chipPlayed` carries a border treatment of its own so the state never
   rests on colour. Without the chaining change a lost Termo is offered as
   the next pending daily forever, from every game's conclusion, and —
   because `DAY_GAMES` puts termo first
   (`apps/web/src/play/conclusion-view.tsx:24`) — as the **default** target.

   **Corrected at #27's step 6, on two counts.** This decision was written
   before the screen existed and got the border and the arithmetic wrong.
   The shipped code is the correct reading of this ADR together with
   [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md); the
   text is what moved.

   - **`.chipPlayed`'s border is SOLID, deliberately not `.chipMissing`'s
     dashed one.** The draft required it *reuse* the dashed border, which
     satisfies the colour rule and defeats the decision the rule serves:
     `played` and `missing` would come out **pixel-identical** — same 1.5px
     dashed `--line`, no tint, `.chipName` unchanged — so three day states
     would render as **two** shapes and the one new state would be
     invisible. What ships is three border treatments, still with no colour
     involved and all three legible in greyscale
     (`apps/web/src/play/conclusion-view.module.css:513-541`): `missing`
     **dashed** (nothing here yet), `played` **solid** (something happened,
     just not a completion), `done` a **tinted fill and no border at all**.
     `--line` on `--paper-card` is 1.4323:1, so the border is a shape
     carrier and not a contrast one — exactly what `.chipMissing` already
     was. The state's 3:1 carrier is the **value string** itself (`jogado`
     vs `falta` vs a duration, `--ink-2` on `--paper-card` at 5.3003:1); the
     border only tells the two non-done chips apart at a glance.
   - **Two values become FOUR, not three.** The draft counted a duration and
     `falta` going to three. `DayChip` ships a duration, `feito`, `jogado`
     and `falta` (`apps/web/src/play/conclusion-view.tsx:576-583`). The
     fourth exists only because
     [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md)
     decision 4 withholds a **won** Termo's duration — a consequence this
     decision predates — so a `completed` entry with no `elapsedMs` needs a
     done string that is not a clock. The guard is split to match: `done` is
     the **status** (`entry.status === "completed"`), and the duration's
     presence only chooses *which* done string prints. A single guard doing
     both jobs would print `falta` beside a game the player had just won.

10. **The conclusion carries a `role="status"` with
    `ConclusionOutcome.aria`, and that is what makes ADR-0042 decision 10's
    "the conclusion owns the terminal sentence" TRUE.** It is not true
    today: `apps/web/src/play/conclusion-view.tsx` was read in full and has
    **no live region and no focus management** — its single `useEffect`
    (`:89-95`) starts the completion sync and nothing else — so on the
    in-place swap the play view unmounts, focus falls to `<body>`, and a
    blind player gets nothing at the product's payoff moment. The gap is
    inherited from three shipped games; converting it into a false claim in
    an ADR is what is not allowed, so it is closed here rather than
    recorded. The region renders on the `result` and `lost` branches, is
    visually hidden, and carries the *already composed* `aria` string
    (decision 8's plain-data rule, so nothing is composed in the component).
    Games that pass no `outcome` render no region and are unchanged. Two
    honest limits: that a live region **mounting** with content is spoken is
    an AT behaviour jsdom cannot prove, so this rides the one real
    VoiceOver/NVDA pass ADR-0042 consequence (e) already owes; and focus
    still does not move — a `role="status"` announces without stealing the
    caret, which is the calmer of the two mechanisms and the one this
    product's *"nothing nags"* principle points at.

## Rejected

- **Widening `ConclusionResult` with an `outcome` field.** ADR-0034's
  Rejected list already refused this shape for `picture`, and the reason
  survives: `stamp = stored ?? result` relies on a play record being
  structurally assignable to `ConclusionResult`, so an optional `outcome`
  would silently read `undefined` — i.e. "won" — on every path that does
  not set it. A sibling prop does not touch that relation.
- **Reusing the `empty` branch for a loss.** *"Você ainda não concluiu o
  Termo de hoje"* is true of a player who never started, and a lie to one
  who played six guesses. It is also the branch ADR-0031's monotone rule
  reserves for *unknown*.
- **A second, consoling stamp** — a different circle, a different word, a
  different animation. It manufactures a reward for failing and it is the
  shape `PRODUCT.md`'s "no gamification chrome" exists to keep out.
- **Putting the canonical spelling on the winning board row.** It
  overwrites the player's own accent-free input, and any reveal on the play
  board is the placement ADR-0034 decision 1 forbids — for a surface that
  persists exactly one animation frame (ADR-0034 consequence (a), measured
  at 11.7 ms median).
- **Carrying the answer on the completion response.** ADR-0033's argument,
  unchanged: discarded by `settle`, and structurally absent on the replay
  path.
- **Marking a lost Termo `concluded: true` so the existing chips and CTA
  "just work".** It would count toward the completed count, show a time on
  the hub, and tell the player they completed a day they did not — the one
  direction ADR-0031's monotone rule forbids: *"A false pending is
  invisible; a false done would be a lie the player can catch."*
- **A `played?: boolean` beside `concluded`, which an earlier draft of this
  decision carried.** Superseded by
  [ADR-0044](./0044-a-lost-termo-is-played-not-pending.md) decision 4: a
  second flag fails *safe* — a consumer that forgot it reads pending —
  where the enum deletes `DayEntry.concluded` and makes every consumer a
  red typecheck. This ADR renders the third verb; it does not model it.

## Consequences

- **(a) `ConclusionView`'s prop list grows by exactly TWO optional
  members, and that is one more than ADR-0034 consequence (c) budgets.**
  That consequence reads *"The prop list grows **one optional member per
  game** with a payoff, and that is the intended shape"* — so two members
  for one game is a stated deviation, not an instance of the rule.
  `outcome?: ConclusionOutcome` and `answer?: ConclusionAnswer`. The
  deviation is accepted because the two are **orthogonal**: `outcome`
  serves the win stamp and the loss stamp both and is what a *game with two
  terminal states* owes, while `answer` is the day's word and renders on
  both outcomes — collapsing them would put a nullable word inside an
  outcome object and make the win branch carry a field it does not gate on.
  There is no third member and no loss-only interface anywhere in the
  design. Three games pass neither and are byte-identical.

  **Naming the deviation here is not enough, so ADR-0034 consequence (c)
  carries the qualification in place** — the same treatment ADR-0028
  decision 2 took on this branch, and for the same reason. A future game's
  author reads ADR-0034 *before* adding a prop and would otherwise find only
  the unqualified budget; a deviation recorded solely in the consequences of
  the ADR that spent it is a correction nobody is routed to.
- **(b) A fourth `data-conclusion-state` value exists, and CI already
  accepts it.** `.github/workflows/impeccable.yml:77-81` greps the response
  body for the attribute *name*, not a value, so `/termo/concluido`
  satisfies the preflight in any branch. The route-SSR suite's marker table
  gains the row.
- **(c) The day card's third verb is rendered here and modelled in
  ADR-0044.** The two must land together: a `DayChip` with a `jogado` value
  and a `DayEntry` with no `"played"` status is a chip nothing can produce,
  and the reverse is a status nothing can show.
- **(d) The loss state is unreachable by `impeccable detect`.** A clean
  browser profile has no record, so the URL scan always renders `empty`.
  Compliance is proved the way ADR-0034 decision 4 names: a **file-mode**
  detect run, jsdom smoke tests, and stylesheet-text assertions —
  including that the loss stamp's class declares no `animation`.
- **(e) The next game that can lose inherits this whole**, and #29's guess
  distribution reads the same fail row this branch renders. Nothing here
  decides the distribution; #27 only owes a row #29 can read (ADR-0008).
