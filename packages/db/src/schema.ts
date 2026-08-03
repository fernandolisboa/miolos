import { COMPLETION_OUTCOMES, GAMES, HINT_GRANT_SOURCES } from "@miolos/core";
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
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
 * - `email` is deliberately NOT unique in M0: two anonymous accounts
 *   attaching the same email is exactly the state that triggers the
 *   ADR-0009 merge — a hard unique index would forbid the designed flow.
 *   Uniqueness semantics land with the attach/merge ticket.
 * - Consents (ADR-0012) are independent nullable timestamps: null = not
 *   consented (reminders default off), set = consented at that moment.
 *   The flag is derivable; the timestamp is the evidence.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email"),
  emailVerifiedAt: timestamptz("email_verified_at"),
  appleId: text("apple_id").unique(), // PG unique: multiple NULLs allowed
  googleId: text("google_id").unique(),
  recoveryConsentAt: timestamptz("recovery_consent_at"),
  reminderConsentAt: timestamptz("reminder_consent_at"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  // No trigger or $onUpdate maintains this column: any future UPDATE of a
  // users row must set it explicitly (to DB-side now()). Nothing updates
  // users yet; the first writer is the email-attach ticket.
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

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
 * - "On time" is DERIVED, never stored:
 *     (completed_at at time zone 'America/Sao_Paulo')::date = date
 *   ADR-0009 recomputes streaks from these rows on merge, so the
 *   derivation must stay the definition. A denormalized column would be a
 *   cache; there is no cache.
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
