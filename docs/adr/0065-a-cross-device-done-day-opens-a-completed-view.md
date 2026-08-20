# ADR-0065 — A cross-device done day opens a completed view, not a playable board

**Status:** Accepted — 2026-08-20 (issue #142, shipped in #153)
**Plan:** [060](../plans/060-issue-142-plan-cross-device-completed-view.md)
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md), [ADR-0043](./0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md), [ADR-0044](./0044-a-lost-termo-is-played-not-pending.md), [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md), [ADR-0051](./0051-statistics-are-read-time-derivations-on-closed-contracts.md), [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md), [ADR-0060](./0060-the-day-payload-is-server-truth-and-the-device-may-only-add-to-it.md)
**Amends:** [ADR-0060](./0060-the-day-payload-is-server-truth-and-the-device-may-only-add-to-it.md) — **decision 8's playable-board sentence, and decision 2 gains the `hintsUsed` annotation** (annotations (f) and (g) there, continuing the #143/#141 series). `Amended by`, not `Superseded in part by`, and the warrant is one line: decision 8's **href sentence stands untouched** — the tile keeps its `href` and needs no rewrite, because the route itself now answers differently — so only the playable-board sentence is corrected while the decision stands, which is `docs/agents/domain.md`'s `Amended by` case (ADR-0031 consequence (d) is the precedent for correcting one sentence of a live decision in place).

**ADR-0053 decision 10 is obeyed, not amended** — in those words, because ADR-0060 said them too and a reviewer will ask: layer 3's honest gap survives **on the archive, where it lives**. The archive screens never import the day seam (`T-WEB-S183`'s ban keeps that mechanical), an archived date's route still renders a playable board, and the late write still works. What is withdrawn is only ADR-0060 decision 8's *citation* of that layer for the **daily hub** path — the daily path now has server evidence the archive path structurally does not.

**Numbering, coordinated:** the in-flight siblings assigned ADR numbers up front rather than "next free" — the assigned map was **0062→#145, 0063→#58, 0064→#140, 0065→#142**. The map shifted under this branch: at its pre-gate merge-from-main, #140 had landed as **ADR-0062** (`0062-termo-guess-dictionary-gaps-close-with-curated-additions.md`) rather than 0064, so the unlanded siblings' numbers move — **0065→#142 is unaffected and is the number this ADR holds**, said here so the next collision is read against the map as it actually resolved.

## Context

ADR-0060 decision 8 shipped the honest gap on the daily path, named: a tile
marked *Feito* from another device linked to a **fresh playable board** in
all four games, because the screen roots swap to the conclusion only off the
**local** record (`isClosedAndFrozen`), and cross-device there is none.
Fernando's answer to PR #135 veto decision 3 (issue #142): if we can identify
the user, state should follow them — the completed state shows instead.

The scope question was what "completed state" can honestly mean, and the
server's storage answers it per game. One write-once row per (user, game,
date): `outcome`, `elapsedMs` (NOT NULL), `hintsUsed` (NOT NULL, write
contracts cap at 1), `guesses` (Termo only, 1–6). **Nothing else** — Termo's
guess words and tiles are not stored (`POST /termo/guess` is stateless by
design; the client re-posts all guesses each turn; no held-turn table
exists), the day's word reaches a device only through the guess route's
close, and Nonogram's picture is the solution, i.e. puzzle content that
never rides this wire (ADR-0004, ADR-0060 decision 2).

## Decision

1. **Evidence-bounded scope — full where the server holds the data, honest
   absence where it does not.** Per game, the cross-device completed view
   renders:

   | Game | Renders | Honest absences, named |
   |---|---|---|
   | Sudoku / Binairo / Nonogram, `completed` | The real conclusion composition: the `Concluído` stamp with the server-held time (`elapsedMs`, on the wire since #141) and hints line (`hintsUsed`, added here — decision 2), the stat block, the streak card, the day card, the next-pending CTA | Nonogram's picture (solution content, ADR-0004); the share button (its text composes from the local record, which does not exist) |
   | Termo, `completed` | The win stamp (the local `OutcomeStamp` shape) with `em X/6` from `GET /stats`' `todayTermoGuesses` — date-gated, the `TermoDoneLink` rule, label-only when the count has not landed or describes another day — the guess distribution with today's row, the streak card, the day card and the next-pending CTA | The guess grid (not stored), the day's word (no reveal channel), the share button |
   | Termo, `played` | The loss stamp shape — no celebration, ADR-0043's loss discipline — plus the guess distribution with the fail row highlighted, the streak card, the day card and the next-pending CTA: the local loss composition mirrored (its stat block and streak gate on the row being on the server, not on the outcome — ADR-0008 rule 3; plan 060 §13 deviation 3) | The day's word, the guess grid, any time or hints line |

   **Full Termo (guess grid + answer word) requires new server storage or a
   new reveal endpoint — that would be its own ticket if ever wanted.** None
   is filed, by decision: nobody has asked for it. Named here rather than
   smuggled in.

2. **One wire field: optional `hintsUsed` on the per-game claim**, the #141
   template exactly. `dayGameStateSchema` gains
   `hintsUsed: z.number().int().min(0).max(1).optional()` beside
   `elapsedMs`, with the same refinement (a value on a non-`completed` claim
   is a parse failure) and the same Termo suppression in `dayGamesFromRows`
   (Termo ships no hint — ADR-0045 decision 1 — so "sem dicas" would present
   as a virtue something that was never possible). `.max(1)` mirrors the
   write contracts: the read side never accepts what the write side refused.
   A future hint-grant ticket (ADR-0006's convenience seam) must raise the
   read cap, the write caps **and the DB check constraint**
   (`completions_hints_used_check`, today only `hints_used >= 0` — no upper
   bound) in one diff: the read side fails as a THROWN parse on `GET /day`
   (the route `parse`s its own output), so a single over-cap row would 500
   the whole day payload — hub, tiles and this view together — not just
   drop a hint line (#142 step-6 correctness F1).
   `listCompletionsForDay` projects the stored NOT NULL column — same
   predicate, same index, **no migration**. Deploy skew is the #148
   precedent verbatim: the strict schema changes shape, a mismatched client
   fails `safeParse`, degrades silently to the local projection (ADR-0060
   decision 6), and the 60 s poll recovers it once both sides deploy.

3. **The seat: a sibling branch in the four daily screen roots plus the
   `/​<jogo>/concluido` empty branch — never a new route, never the
   archive.** The hook (`useServerDayClaim(date, game)` in
   `play/day-state.ts`, keeping ADR-0060 consequence (d)'s single-importer
   rule true) hoists to the top of each root by the rules of hooks; only the
   **branch** sits after `isClosedAndFrozen`, so **the local closed record
   wins first** — ADR-0060 decision 7's mirror unchanged: a local win over a
   server `played` renders this device's own conclusion. The tile's `href`
   is untouched; a bookmark or a typed URL gets the completed view because
   the route itself answers with it.

4. **The stamp renders per line, never a fabricated value.** A deploy-skew
   claim (old server, new client) carries `elapsedMs` and no `hintsUsed`:
   the remote stamp renders the time line it has and **omits** the hints
   line — never `hintsUsed: 0` invented on the client. Where the claim
   carries both, the stamp is the local `ShippedStamp` itself, byte-identical
   by construction.

5. **Stats and streak gate on the claim itself, replacing `syncOutcome ===
   "recorded"`:** a server claim is strictly stronger evidence than
   `recorded` — the row IS on the server, which is all `recorded` ever
   proved. `GET /stats` is fetched **once** per remote view (the hook lifts
   to `RemoteConclusionView`; the Termo stamp and the distribution share the
   answer through a stats-as-prop presentational body split out of the local
   block).

6. **The mid-play rule: the claim wins over an in-progress board too.** The
   swap is the same render-time mechanism as the local closure swap, the day
   is already decided server-side (write-once row — finishing locally would
   record nothing), and the in-progress record is **neither written nor
   deleted** (ADR-0060 decision 4 untouched). Cost named: a stale device
   mid-solve loses the board *view*, not the record, when the poll lands.

7. **No replay, not even read-only, and the claim never becomes a play
   record.** No link into this game's playable board renders anywhere on
   the remote view; the `notYet` "Jogar" CTA never appears there. No
   CONCLUDED record is ever synthesised from the claim (ADR-0060 decision 4
   verbatim) — on `/​<jogo>` the play lifecycle behind the view keeps
   writing its own PLAYING record exactly as it did before #142
   (`T-WEB-S273` asserts both halves), and an in-progress record survives
   the swap untouched (decision 6). The view is a projection of the claim
   and dies with the evidence for it — the date gate retires the payload at
   the São Paulo rollover and the old day's playable board returns, the
   understating direction the hub already ships.

8. **#145's push opt-in card does not render on the remote completed
   view.** That card belongs to a genuine post-solve conclusion — the moment
   after this device recorded a win — not to a projection of another
   device's day. #145 had not landed when this shipped, so the exclusion is
   stated here for its reviewers rather than asserted in a test; the first
   ticket that puts the card into `conclusion-view.tsx` owes the test arm.
   *Annotation (#145):* that ticket paid it — the card rides
   `ConclusionAside`'s `prompt` slot, filled by the local view only, and
   `T-WEB-S272` (`remote-conclusion.test.tsx`) asserts the remote view
   renders no card and fires no push state fetch.

## Rejected

- **Option (a), a bare "Feito em outro aparelho" card** — it discards stats,
  streak and time the server verifiably holds; the absence would be
  dishonest in the other direction.
- **Option (b), the full per-game conclusion** — Termo's guess grid and the
  day's word are not stored and have no read channel; shipping them means
  new storage or a reveal endpoint — its own ticket if ever wanted, and
  none is filed.
- **A new route (`/​<jogo>/feito`)** — the tile's `href` already points at
  the play route, and a second URL for the same fact is a second thing to
  keep honest.
- **Writing the claim into a play record** — ADR-0060 decision 4's argument
  verbatim: it would imply board content the device does not have and make
  the done view outlive the evidence for it.

## Consequences

- **(a) The credentialed-GET count grows, sized in ADR-0060 consequence
  (a)'s language.** Hoisting the hook subscribes the day-truth store on
  **every play-screen mount**: the four play routes, which made **zero**
  `/day` calls, each gain one credentialed `GET /day` plus the 60 s
  visible-tab poll for the play session (shared store — a hub-warmed payload
  is reused, but the subscription and the poll are new to these routes). A
  **mounted remote view** adds one `GET /streak` and one `GET /stats` (the
  single lifted call). ADR-0051 decision 3's hub-endpoint trigger is sized
  against these counts and is not pre-empted here.
- **(b) `T-WEB-S245`'s playable-board arm is deleted, successor
  `T-WEB-S273`** — the `T-WEB-S235`/`T-WEB-S96` precedent: a landed
  assertion removed because its claim was amended false is a pointer at a
  record, and the record is ADR-0060's decision-8 annotation (g). S245's
  href and no-record arms survive, re-aimed.
- **(c) The visual gate's URL-mode scan cannot reach the remote states**
  (cold profile, `/day` answers 401 — ADR-0060 consequence (c) unchanged);
  the evidence is a local `impeccable detect file://` over the real
  component and stylesheet for the three new compositions, plus committed
  screenshots.
- **(d) The demotion re-renders correctly:** the remote view keys on
  `claim.status`, so a later payload correcting a Termo win to a loss
  re-renders the played shape; where the LOCAL record is a closed win,
  branch order gives this device its own conclusion (decision 7's accepted
  mirror, untouched).
