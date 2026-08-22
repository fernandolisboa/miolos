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
 * The DB clock is the only clock: every timestamp is timestamptz with a
 * DB-side default; no JS-constructed date is ever passed to an insert.
 */
const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

/**
 * Anonymous-first (ADR-0003): every column beyond `id` is nullable because a
 * user is born with nothing but an id.
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
     * NULL = never dismissed (#21, ADR-0050 decision 9). MIGRATION: nullable,
     * because adding ANY users column changes the INSERT list drizzle emits
     * for every writer — so it must reach Neon before the branch's first
     * push (ADR-0038 (h); previews share the production database).
     */
    attachPromptDismissedAt: timestamptz("attach_prompt_dismissed_at"),
    /** NULL = never acknowledged (#35, ADR-0061). */
    onboardingSeenAt: timestamptz("onboarding_seen_at"),
    /** NULL = never dismissed, including a denied browser permission (#145, ADR-0064). */
    pushPromptDismissedAt: timestamptz("push_prompt_dismissed_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // Unique only among VERIFIED emails (ADR-0050 decision 6); NULLs exempt.
    uniqueIndex("users_verified_email_uq")
      .on(t.email)
      .where(isNotNull(t.emailVerifiedAt)),
  ],
);

/**
 * Opaque session tokens (ADR-0022): only the SHA-256 hash of the token is
 * stored, so a database leak leaks no usable credential.
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
 * Web Push subscriptions (#145, ADR-0064): one row per browser install,
 * several per user. `p256dh`/`auth` are the RFC 8291 client keys.
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
  (t) => [index("push_subscriptions_user_id_idx").on(t.userId)],
);

/**
 * The notification-send ledger (#146, ADR-0064 d7): one row per (user, SP
 * day, channel) = "this nudge is claimed". APPEND-ONLY; claimed by the
 * dispatcher BEFORE any send, so a crash after the claim loses that nudge
 * rather than risking a double send.
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
 * Magic-link attach tokens (#21, ADR-0050 decision 2): the sessions
 * hash-only idiom, plus expiry and single use.
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
  (t) => [index("attach_tokens_user_id_idx").on(t.userId)],
);

/**
 * The daily-puzzle buffer (ADR-0010): pre-generated, future-dated rows —
 * the "unpublished content" ADR-0004 protects. Reachable only from
 * `@miolos/db/publishing`.
 *
 * `seed` is PROVENANCE ONLY and reproduces nothing — do not build a
 * "recompute that day's puzzle" tool on this column.
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
 * Completion rows (ADR-0008, ADR-0026): one row per (user, puzzle), written
 * ONCE — the composite PK enforces it. `on_time` is decided once at write
 * time and STORED (#58, ADR-0066) so streaks stay derivable from
 * completions alone (ADR-0009); `elapsed_ms`/`hints_used` are
 * self-reported, never a medal's basis (ADR-0027).
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
    /** The Termo guess count; NULL for every other game (see the CHECK below). */
    guesses: integer("guesses"),
    /** The write-time on-time verdict (#58, ADR-0066). */
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
    // Equality (not the permissive `guesses is null or game = 'termo'`) so a
    // termo row without a count and a grid row with one are both impossible.
    check(
      "completions_guesses_check",
      sql`(${t.game} = 'termo') = (${t.guesses} is not null)
          and (${t.guesses} is null or ${t.guesses} between 1 and 6)`,
    ),
    // The PK covers (user_id)/(user_id, game); this covers (user_id, date).
    index("completions_user_date_idx").on(t.userId, t.date),
    // Partial on won ∧ on-time = "counted" (ADR-0048). Indexed on (date)
    // alone: the planner refuses the wider (date, user_id) key (measured).
    index("completions_counted_date_idx")
      .on(t.date)
      .where(sql`${t.outcome} = 'won' and ${t.onTime}`),
  ],
);

/**
 * Seen days (#58, ADR-0066): one row per (user, São Paulo day) the server
 * saw this user online, consulted ONLY at `POST /completions` write time.
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
 * ships yet. APPEND-ONLY, never a wallet: `grantedHintsToday` sums `hints`
 * for `date = SP-today`, so a grant expires structurally as the day rolls.
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
 * Curated medal grants (#30, ADR-0052): APPEND-ONLY, not a wallet;
 * rule-derived medals recompute from completions instead. `medal_id`'s
 * CHECK is a SHAPE check, not membership — catalog drift stays a read-time
 * no-op.
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
 * `remoteConfigSchema` (@miolos/core).
 */
export const remoteConfig = pgTable("remote_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});
