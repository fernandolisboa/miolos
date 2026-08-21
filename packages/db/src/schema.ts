import { COMPLETION_OUTCOMES, GAMES, HINT_GRANT_SOURCES } from "@miolos/core";
import { isNotNull, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * All timestamps are timestamptz with DB-side defaults — the database clock
 * is the only clock; no JS-constructed date ever appears in an insert
 * (issue #15 AC 5).
 */
const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

/**
 * Anonymous-first users (ADR-0003): every column beyond the id is nullable
 * because a user is born with nothing but an id. Email/verification and the
 * social ids exist from day one so later tickets attach, never migrate.
 *
 * - `email` uniqueness semantics, resolved by #21 (ADR-0050 decisions 2
 *   and 6): the column is written ONLY at attach-confirm, in the same
 *   UPDATE that sets `email_verified_at`, so a non-null email implies
 *   verified — and the flow keeps at most one verified holder (the merge
 *   nulls the loser's email before the winner gains it). The partial
 *   unique index `users_verified_email_uq` below is the mechanical
 *   backstop for the one race the flow cannot close: two concurrent
 *   confirms of the same email onto different winners fail loudly instead
 *   of silently forking the identity.
 * - Consents (ADR-0012) are independent nullable timestamps: null = not
 *   consented (reminders default off), set = consented at that moment.
 *   The flag is derivable; the timestamp is the evidence (ADR-0022's
 *   narrowing, kept by ADR-0050 decision 7 — the withdrawal surface that
 *   would need flag columns does not exist in v1).
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email"),
    emailVerifiedAt: timestamptz("email_verified_at"),
    appleId: text("apple_id").unique(), // PG unique: multiple NULLs allowed
    googleId: text("google_id").unique(),
    recoveryConsentAt: timestamptz("recovery_consent_at"),
    reminderConsentAt: timestamptz("reminder_consent_at"),
    /**
     * The attach prompt's one lifecycle per account (#21, ADR-0050
     * decision 9): NULL = never dismissed; a timestamp = the player pressed
     * "agora não" and the prompt never returns. Deliberately NOT in the
     * tombstone SET (merge.ts statement 6): it is not an identity handle,
     * and a loser's value stays on the tombstone untouched.
     *
     * MIGRATION `0004`: nullable, so every existing row satisfies it — but
     * adding ANY users column changes the INSERT column list drizzle emits
     * for every writer, `mintSession`'s `insert(users).values({})`
     * included, so 0004 reaches Neon BEFORE the branch is first pushed
     * (ADR-0038 (h); preview deploys share the production database).
     */
    attachPromptDismissedAt: timestamptz("attach_prompt_dismissed_at"),
    /**
     * The first-visit introduction's one lifecycle per account (#35,
     * ADR-0061): NULL = never acknowledged; a timestamp = the player
     * pressed "Entendi" and the card never returns. Server-owned so the
     * fact survives cleared site data AND attach/merge (the acceptance's
     * own words — a device store survives neither). Deliberately NOT in
     * the tombstone SET (merge.ts statement 6): it is not an identity
     * handle, and a loser's value stays on the tombstone untouched.
     * Folded onto the winner earliest-wins by merge.ts statement 5d,
     * together with `attach_prompt_dismissed_at` above (whose own merge
     * gap was #134, closed by the same statement).
     *
     * MIGRATION `0006`: nullable, so every existing row satisfies it — but
     * adding ANY users column changes the INSERT column list drizzle emits
     * for every writer, `mintSession`'s `insert(users).values({})`
     * included, so 0006 reaches Neon BEFORE the branch is first pushed
     * (ADR-0038 (h); preview deploys share the production database).
     */
    onboardingSeenAt: timestamptz("onboarding_seen_at"),
    /**
     * The push pre-prompt's one lifecycle per account (#145, ADR-0064): the
     * `attachPromptDismissedAt` doc block cloned. NULL = never dismissed; a
     * timestamp = the player pressed "Agora não" (or the browser denied the
     * permission) and the card never returns. Deliberately NOT in the
     * tombstone SET (merge.ts statement 6): it is not an identity handle,
     * and a loser's value stays on the tombstone untouched. Folded onto the
     * winner earliest-wins by merge.ts statement 5d, as the third column of
     * the fold that already carries `onboarding_seen_at` and
     * `attach_prompt_dismissed_at`.
     *
     * MIGRATION `0007`: nullable, so every existing row satisfies it — but
     * adding ANY users column changes the INSERT column list drizzle emits
     * for every writer, `mintSession`'s `insert(users).values({})`
     * included, so 0007 reaches Neon BEFORE the branch is first pushed
     * (ADR-0038 (h); preview deploys share the production database).
     */
    pushPromptDismissedAt: timestamptz("push_prompt_dismissed_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    // No trigger or $onUpdate maintains this column: any UPDATE of a users
    // row must set it explicitly (to DB-side now()). The writers are
    // `mergeAccounts` (merge.ts — statement 6 empties a tombstoned LOSER's
    // identity handles, ADR-0009/ADR-0049, and statement 5d, the first
    // writer of a WINNER's updated_at, folds the three once-per-account
    // timestamps earliest-wins, #35/#134/#145), #21's attach-confirm and
    // dismiss statements (`attachEmailToUser` / `dismissAttachPrompt`,
    // apps/api/src/attach/service.ts, ADR-0050), #35's
    // `markOnboardingSeen` (apps/api/src/onboarding/service.ts,
    // ADR-0061), and #145's `dismissPushPrompt`
    // (apps/api/src/push/service.ts, ADR-0064). Account deletion is a
    // DELETE, not an UPDATE, and belongs to no updated_at list.
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // At most one VERIFIED holder per email, ever (ADR-0050 decision 6).
    // Partial on purpose: unverified emails never exist on users under D2's
    // write-only-at-confirm rule, so a plain unique index would be
    // materially equivalent today — the partial shape self-describes the
    // invariant and stays robust to futures where unverified emails might
    // exist. Multiple NULLs are exempt by the predicate itself.
    uniqueIndex("users_verified_email_uq")
      .on(t.email)
      .where(isNotNull(t.emailVerifiedAt)),
  ],
);

/**
 * Opaque session tokens (ADR-0022): the server stores only the SHA-256 hex
 * hash of the 256-bit token — a database leak leaks no usable credential,
 * and lookup-by-hash means no timing-sensitive comparison exists anywhere.
 * `last_seen_at` backs the sliding-staleness definition (bumped only when
 * >1h stale); revocation and the ADR-0009 merge remap are row operations.
 */
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    lastSeenAt: timestamptz("last_seen_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

/**
 * Web Push subscriptions (#145, ADR-0064; the #32 shape §2): one row per
 * browser install, several rows per user (phone + desktop) is the design.
 *
 * - `endpoint` is the push service's capability URL, stored raw — it is
 *   what the dispatcher (#146) sends to — and it is the PRIMARY KEY: the
 *   browser install is the authority for its own endpoint, so a re-POST
 *   upserts (key rotation, or the endpoint following whoever the cookie
 *   now says) rather than duplicating.
 * - `p256dh` / `auth` are the client keys of RFC 8291; opaque text here.
 * - `created_at` is the consent evidence (the ADR-0022 idiom — the
 *   timestamp is the evidence, no separate consent column): subscribing IS
 *   the consent act, and deleting the row is withdrawal (the settings
 *   toggle in #36, browser-side revocation surfacing as 410-pruning in
 *   #146, or account deletion via the FK cascade).
 * - ADR-0049 merge duty: `mergeAccounts` statement 1b repoints a loser's
 *   rows to the winner (the sessions precedent — and unlike sessions these
 *   are NOT revoked by ADR-0050 decision 13, which is about cookie
 *   takeover; a device's push channel follows the merged identity).
 *
 * The statements over this table live in apps/api/src/push/service.ts
 * (the onboarding/service.ts precedent); the table export rides the same
 * `@miolos/db` entry `users` does.
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    endpoint: text("endpoint").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  // The dispatcher's read and the merge remap both scan by user
  // (the sessions-index precedent).
  (t) => [index("push_subscriptions_user_id_idx").on(t.userId)],
);

/**
 * The notification-send ledger (#146, ADR-0064 decision 7; ADR-0067):
 * one row per (user, SP day, channel) = "this user's nudge for this day on
 * this channel is claimed". APPEND-ONLY — nothing updates or deletes a row
 * inside a day's lifetime; account deletion cascades, and the merge empties
 * the loser's rows onto the winner (below).
 *
 * - The ONLY writers are the dispatcher's claim — `INSERT … ON CONFLICT DO
 *   NOTHING RETURNING`, BEFORE any send (claim-first, ADR-0064 decision 7:
 *   a crash after the claim loses that day's nudge for that user, the
 *   priced residual — never a double send) — and `mergeAccounts`'
 *   union/empty pair (statements 5e/5f, the seen-days 4b/4c idiom).
 * - The only reader is the candidate query's `not exists` PREFILTER
 *   (notify.ts): the claim insert is the race authority, the prefilter just
 *   keeps already-claimed users out of the candidate list.
 * - `date` is the SP day the nudge protects (= today at claim time), string
 *   mode like every date column here — no JS Date mangles it.
 * - `channel` admits 'email' so slice C's arm (#32 Q1 = 1a) rides the same
 *   ledger without a migration; nothing writes 'email' today.
 * - `sent_at` is the DB clock at claim (the schema.ts law); the merge
 *   COPIES it, never re-stamps (presence is presence — whichever row
 *   survives a PK collision, its whole function is "do not send again").
 * - No index beyond the composite PK: the claim and the prefilter both hit
 *   the full key. The candidate query's habitual CTE aggregates over every
 *   user with in-window completions before the push_subscriptions join —
 *   harmless at v1 scale; the recorded restructure trigger is in notify.ts.
 *
 * User-scoped: reachable only via `@miolos/db/user` (ADR-0026 decision 5)
 * — apps/web mechanically cannot name the ledger. The statements over it
 * live in notify.ts and merge.ts.
 */
export const notificationSends = pgTable(
  "notification_sends",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    channel: text("channel").notNull(),
    sentAt: timestamptz("sent_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.date, t.channel] }),
    check(
      "notification_sends_channel_check",
      sql`${t.channel} in ('push', 'email')`,
    ),
  ],
);

/**
 * Magic-link attach tokens (#21, ADR-0050 decision 2) — the sessions idiom
 * plus expiry and single use. Only the SHA-256 hex of a 32-byte Web-Crypto
 * token is stored (hash PK): a database leak leaks no usable credential,
 * and lookup-by-hash means no timing-sensitive comparison exists anywhere.
 *
 * - `email` rides HERE, already normalized (trim + lowercase at the Zod
 *   boundary, D6 layer 1), until the click proves it: `users.email` is
 *   written only at confirm, so an unverified stranger's form submission
 *   never decorates a users row.
 * - Expiry is a DB-side predicate on the claim
 *   (`created_at > now() - interval '30 minutes'`) — no expires_at column,
 *   no JS clock. 30 minutes is tunable by ADR amendment only (a security
 *   parameter, not a product knob).
 * - Single use IS the claim: one atomic `DELETE … RETURNING`, race-safe
 *   without a transaction — the loser of a double-confirm sees zero rows,
 *   and unknown, expired and spent tokens are indistinguishable (410).
 * - The rows double as the rate-limit ledger (3 per rolling hour per user
 *   AND per normalized email, ADR-0050 decision 11): cleanup deletes ALL
 *   rows older than the ONE-HOUR rate window, never the 30-minute expiry —
 *   deleting at expiry would empty the 30–60-minute band the count needs
 *   and silently double the limit. The sweep is GLOBAL, not per-user (a
 *   row past the hour is dead for claim and counts alike, whoever's), so
 *   any request bounds the whole table; rows outlive the window only
 *   while nobody requests at all.
 *
 * The statements over this table live in apps/api/src/attach/service.ts
 * (the session/service.ts precedent); the table is reachable only via
 * `@miolos/db/user` (ADR-0026 decision 5).
 */
export const attachTokens = pgTable(
  "attach_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    reminderConsent: boolean("reminder_consent").notNull().default(false),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  // The per-user rate-count scan (the sessions-index precedent); the
  // global cleanup sweeps by created_at over a table this small.
  (t) => [index("attach_tokens_user_id_idx").on(t.userId)],
);

/**
 * The daily-puzzle buffer (ADR-0010): pre-generated, pre-validated,
 * future-dated rows — "the buffer rows are precisely the 'unpublished
 * content' ADR-0004 protects. They exist server-side only." Every read
 * goes through the wall in `published.ts` (`published_at <= now() AND
 * killed_at IS NULL`); the raw table is exported only from
 * `@miolos/db/publishing` (ADR-0024, plan 014 D16).
 *
 * - Composite PK (game, date): the ON CONFLICT idempotency anchor for the
 *   cron's top-up, the "one puzzle per game per day" product statement in
 *   schema form, and the covering index for the hot read (D11).
 * - `date` is the America/Sao_Paulo calendar day, string mode so no JS
 *   Date ever mangles it through a timezone.
 * - `seed` is a random uint32 chosen at generation time (D2) — bigint
 *   because Postgres integer is signed-31-bit. Never derived from
 *   (game, date): a derivable seed makes future dailies precomputable.
 *   **PROVENANCE ONLY: THIS VALUE REPRODUCES NOTHING** (ADR-0040 decision 3,
 *   which promises a reader finds the sentence here). It is not an input a
 *   generator can be re-run against — the three grid games consume it inside
 *   a generator whose output is stored, and termo does not consume it at all:
 *   its answer is drawn by `crypto.getRandomValues` over a run-scoped
 *   filtered pool and the drawn WORD is what `content` stores. The invariant
 *   that replaces reproducibility is "the row served is the row stored",
 *   whose mechanism is immutability (D14), not a seed. Do not build a
 *   "recompute that day's puzzle" tool on this column.
 * - `content` is the full validated engine output INCLUDING the solution
 *   (D1); rows are immutable once inserted (D14) and reads strip inside
 *   the wall.
 * - `published_at` is the SP midnight of `date` as an instant, derived
 *   DB-side in the INSERT expression (D8) — Postgres tzdata owns the
 *   conversion; no JS-constructed date ever appears in an insert.
 * - `killed_at` is the kill switch (null = alive), set via sql`now()`
 *   only — the timestamp is the evidence (ADR-0022 style).
 */
export const dailyPuzzles = pgTable(
  "daily_puzzles",
  {
    game: text("game", { enum: GAMES }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    seed: bigint("seed", { mode: "number" }).notNull(),
    content: jsonb("content").notNull(),
    publishedAt: timestamptz("published_at").notNull(),
    killedAt: timestamptz("killed_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.game, t.date] }),
    check(
      "daily_puzzles_game_check",
      sql`${t.game} in ('binairo', 'sudoku', 'nonogram', 'termo')`,
    ),
  ],
);

/**
 * Completion rows (ADR-0008, ADR-0026). One row per (user, puzzle),
 * written ONCE — a loss followed by an archive replay does not reopen the
 * daily, and the composite PK is what makes "exactly once" mechanical
 * rather than a code convention (plan 017 D15).
 *
 * - `date` is the PUZZLE's America/Sao_Paulo calendar day, string mode so
 *   no JS Date mangles it through a timezone. Never the completion
 *   instant's day.
 * - `completed_at` is the DB clock at insert (`defaultNow()`); no
 *   JS-constructed date ever appears in an insert, and no client-supplied
 *   instant is accepted anywhere in the path (plan 017 D16/D19).
 * - "On time" is DECIDED ONCE AT WRITE TIME and STORED on the row (#58,
 *   ADR-0066, amending ADR-0026 decision 2). The write-time rule is
 *   `onTimeAtWrite` (packages/core): the puzzle's own SP day, or exactly
 *   one day back with a server-recorded seen day (`user_seen_days`). It is
 *   stored — not derived at read time — because ADR-0009's real constraint
 *   is that a streak stays derivable from completion rows ALONE, and once
 *   the seen-fact enters the definition a read-time derivation would have
 *   to consult a second table on every streak read. Every reader projects
 *   the stored column; no reader re-derives.
 * - `outcome` accommodates 'lost' from day one so #27 (Termo) attaches
 *   rather than migrates. Binairo only ever writes 'won'.
 * - `elapsed_ms` and `hints_used` are player statistics, not authority:
 *   they come from the client and are range-checked at the contract
 *   boundary. `hints_used` is where the ADR-0006 free hint is recorded —
 *   there is no balance anywhere (plan 017 D21) — and it is SELF-REPORTED,
 *   so it can never back a "solved without hints" medal (ADR-0027).
 * - ADR-0009 merge duty: the PK makes re-pointing rows a CONFLICT
 *   operation. The merge re-points with
 *   `ON CONFLICT (user_id, game, date) DO NOTHING` after ordering the
 *   source rows by `completed_at`, so the surviving row is the EARLIEST
 *   completion and a merge can never downgrade on-time to late.
 *
 * EXTENSION POINT, PARTLY CLOSED: #23 and #25 wrote through this table and
 * route with no schema change, as predicted. **#27 did not** — Termo's guess
 * count has nowhere else to live, so it added the `guesses` column and the
 * `completions_guesses_check` below (ADR-0038 decision 6). It could not be
 * deferred: the row is write-once (ADR-0026 decision 1), so a Termo row
 * written without its count is permanently absent from the distribution
 * ADR-0008 rule 3 needs. What still holds is the shape of the prediction —
 * one route, one table, one request union — and #29's statistics projection
 * is expected to need no schema change either.
 */
export const completions = pgTable(
  "completions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    game: text("game", { enum: GAMES }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    completedAt: timestamptz("completed_at").notNull().defaultNow(),
    outcome: text("outcome", { enum: COMPLETION_OUTCOMES }).notNull(),
    elapsedMs: integer("elapsed_ms").notNull(),
    hintsUsed: integer("hints_used").notNull().default(0),
    /**
     * The number of guesses a Termo completion took. NULL for every other
     * game, and NULL is the only legal value for them (see the CHECK below).
     *
     * WRITE-ONLY IN #27, deliberately. `getCompletion`'s projection does not
     * select it, so `CompletionRecord` does not grow and
     * `completionResponseSchema.parse({ ...record, recorded })` — a
     * `z.strictObject` at `apps/api/app/completions/route.ts` — cannot break
     * on an unexpected key. Widening the record would have thrown on EVERY
     * completion in the app. The statistics ticket adds the projection when
     * it needs it (T-DB-S11 pins the omission).
     *
     * It could NOT be deferred to that ticket: ADR-0026 decision 1 makes the
     * row write-once (`ON CONFLICT DO NOTHING`, never `DO UPDATE`), so a row
     * written before the column exists can never be backfilled, and every
     * Termo day played in between would be permanently absent from the guess
     * distribution ADR-0008 rule 3 requires.
     *
     * MIGRATION `0003_omniscient_venom.sql`, and it reaches Neon BY HAND via
     * `DATABASE_URL_UNPOOLED` — nothing in CI or Vercel runs migrations.
     * `db:migrate` (`drizzle-kit migrate`) must NEVER be pointed at Neon: it
     * reconciles `migrations/meta/_journal.json` against a bookkeeping table
     * it maintains inside the target database, and every migration in this
     * repo was applied with `psql -f`, which writes no such row. `db:generate`
     * is the only half of the pair this repo uses.
     *
     * ADDING THIS COLUMN CHANGES THE SQL FOR ALL FOUR GAMES, not just termo.
     * Drizzle builds an INSERT's column list from THIS object, never from the
     * values object, so an un-supplied `guesses` is emitted as the keyword
     * `default` and a bare `.returning()` selects it — measured against
     * drizzle-orm 0.45.2. A deploy that precedes the apply therefore 500s
     * `POST /completions` for binairo, sudoku and nonogram too (ADR-0038 (h)).
     */
    guesses: integer("guesses"),
    /**
     * The write-time on-time verdict (#58, ADR-0066). NO DEFAULT in this
     * object, deliberately — drizzle builds every INSERT's column list from
     * the table (the `guesses` precedent above), so every code writer must
     * decide, and an omission is a loud red, never a silent `false`.
     *
     * MIGRATION `0008` adds the column with a TEMPORARY database-side
     * `default false` (previews share the production DB, so old production
     * code keeps inserting without the column until the deploy) plus the
     * one-directional backfill; migration `0009`, applied AFTER the
     * production deploy, re-runs the sweep for the old-code window and
     * DROPS the default so hand-written SQL fails loudly too. Both
     * migrations reach Neon by hand (the `guesses` ritual above); 0008
     * before the branch's first push, 0009 after the deploy (ADR-0066).
     */
    onTime: boolean("on_time").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.game, t.date] }),
    check(
      "completions_game_check",
      sql`${t.game} in ('binairo', 'sudoku', 'nonogram', 'termo')`,
    ),
    check("completions_outcome_check", sql`${t.outcome} in ('won', 'lost')`),
    check("completions_elapsed_ms_check", sql`${t.elapsedMs} >= 0`),
    check("completions_hints_used_check", sql`${t.hintsUsed} >= 0`),
    // An EQUALITY between two booleans, and it is stronger than the
    // permissive `guesses is null or game = 'termo'` on purpose: it makes a
    // termo row WITHOUT a count and a grid row WITH one both impossible.
    // Every existing row satisfies it (`false = false`), which is what made
    // applying the migration ahead of the deploy a provable non-event.
    // The literal `6` is spelled out to match the CHECKs above: importing
    // `MAX_GUESSES` would give `packages/db` a `@miolos/games` dependency it
    // deliberately does not have, dragging the word list in with it.
    check(
      "completions_guesses_check",
      sql`(${t.game} = 'termo') = (${t.guesses} is not null)
          and (${t.guesses} is null or ${t.guesses} between 1 and 6)`,
    ),
    // The PK covers (user_id) and (user_id, game); the streak recompute and
    // "the day so far" both read (user_id, date) across games.
    index("completions_user_date_idx").on(t.userId, t.date),
  ],
);

/**
 * Seen days (#58, ADR-0066): one row per (user, São Paulo day) recording
 * that the server saw this user online on that day. It is what makes a
 * late-synced completion creditable: a completion for day `D` that syncs
 * after the rollover stores `on_time = true` iff this table holds
 * (user, D) — the server's own knowledge, never a client assertion.
 *
 * - CONSULTED ONLY AT WRITE TIME, inside `POST /completions` (`wasSeenOn`,
 *   seen-days.ts). No streak, statistics, medal or day-state computation
 *   reads it, and the pure merge recompute never consults it — so a streak
 *   stays derivable from completion rows alone (ADR-0009, untouched).
 * - A row is the WHOLE fact: no timestamp column, because nothing would
 *   read it (an unread surface is a standing HIGH finding) and the merge
 *   union needs none — `ON CONFLICT DO NOTHING` suffices.
 * - The composite PK is the idempotency, the completions pattern: the
 *   writer is `recordSeenDay`'s `ON CONFLICT DO NOTHING`, dated by the DB
 *   clock (ADR-0010 — no JS date math on the path).
 * - RETENTION (ADR-0066): only `today − 1` is ever read, so the daily
 *   `/cron/publish` run deletes rows older than that. Widening the credit
 *   window widens that predicate too.
 * - ADR-0049 merge duty: merged by UNION (the completions idiom) —
 *   `mergeAccounts` statements 4b/4c insert the loser's dates onto the
 *   winner `ON CONFLICT DO NOTHING`, then empty the loser.
 *
 * User-scoped: reachable only via `@miolos/db/user` (ADR-0026 decision 5);
 * the statements over it live in seen-days.ts.
 */
export const userSeenDays = pgTable(
  "user_seen_days",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

/**
 * Day-scoped hint grants (ADR-0006, ADR-0027) — DORMANT in v1: no ads SDK
 * ships, so nothing writes a row. The GRANT-EVENT schema exists now so the
 * rewarded-ad ticket attaches rather than migrates; that ticket still adds
 * its own CONSUMPTION record, which v1 deliberately does not model
 * (plan 017 §11).
 *
 * This is deliberately NOT a wallet, balance or ledger:
 * - rows are APPEND-ONLY records of a grant event; nothing ever decrements;
 * - `grantedHintsToday` is `sum(hints) where date = SP-today`, so a grant
 *   EXPIRES structurally when the day key falls behind — no expiry job, no
 *   TTL column, no carry-over across days;
 * - the v1 free hint is per-puzzle and writes no row at all (D21); it is
 *   recorded on `completions.hints_used`.
 * A future column named like a balance (`hints_remaining`, `credits`, …)
 * would violate ADR-0006; test/user.test.ts pins this table's column set
 * exactly so such a column fails the suite.
 */
export const hintGrants = pgTable(
  "hint_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(), // the SP day it is valid for
    source: text("source", { enum: HINT_GRANT_SOURCES }).notNull(),
    hints: integer("hints").notNull(),
    grantedAt: timestamptz("granted_at").notNull().defaultNow(),
  },
  (t) => [
    check("hint_grants_source_check", sql`${t.source} in ('rewarded-ad')`),
    check("hint_grants_hints_check", sql`${t.hints} > 0 and ${t.hints} <= 10`),
    index("hint_grants_user_date_idx").on(t.userId, t.date),
  ],
);

/**
 * Curated medal grants (#30, ADR-0052) — NOT a wallet, balance or ledger:
 * rows are APPEND-ONLY records of a grant event, and no quantity column
 * exists to accumulate (revocation, if ever needed, is a DELETE — grants
 * are append-only events like hint grants). Rule-derived medals are NEVER
 * stored here: they recompute over `listCompletionsForStats` on every
 * read, and a row bearing a rule-derived id is ignored at read time
 * (ADR-0052) — storing one could fake an uncomputed feat or desync from
 * a recompute.
 *
 * The v1 writer is the documented operator ritual (ADR-0052): a one-off
 * script over `@neondatabase/serverless` inserting with
 * `ON CONFLICT (user_id, medal_id) DO NOTHING` — no code writer exists,
 * deliberately (an exported writer with no named caller is the dormant
 * surface this repo treats as a finding). The one production reader is
 * `listMedalGrants` (medals.ts). Merged by union-earliest-dedupe
 * (merge.ts). Pinned by T-DB-S38 (column set), T-DB-S39 (table set) and
 * T-DB-S43 (forbidden-vocabulary column scan).
 *
 * - Composite PK (user_id, medal_id): the completions shape — exactly the
 *   unique key the merge's ON CONFLICT needs; no `id`, no `source`, no
 *   `reason` (a reason is operator context that lives in the grant's
 *   paper trail, not in a column with one writer and no reader).
 * - `medal_id` carries a SHAPE CHECK (lowercase slug, ≤ 64), never a
 *   membership CHECK: definitions live in code, so catalog/DB drift must
 *   be a read-time no-op, not an insert-time production failure.
 * - `granted_at` never crosses the wire (ADR-0052): its named readers are
 *   the merge statement's `least()` (earliest-wins) and the operator's
 *   audit queries. DB-side default; the merge always COPIES it.
 * - No secondary index: every read is by user_id, the PK's leading column.
 */
export const medalGrants = pgTable(
  "medal_grants",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    medalId: text("medal_id").notNull(),
    grantedAt: timestamptz("granted_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.medalId] }),
    check(
      "medal_grants_medal_id_check",
      sql`${t.medalId} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(${t.medalId}) <= 64`,
    ),
  ],
);

/**
 * Remote config (ADR-0025): key/jsonb rows merged and Zod-parsed through
 * `remoteConfigSchema` (@miolos/core), in-code defaults when empty.
 * First tunable: bufferDepth (7). Tuning is one INSERT/UPDATE — no
 * deploy. Reachable only via `@miolos/db/publishing` (ADR-0024).
 */
export const remoteConfig = pgTable("remote_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});
