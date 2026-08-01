import { GAMES } from "@miolos/core";
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
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
