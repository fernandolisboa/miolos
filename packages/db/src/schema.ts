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

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email"),
    emailVerifiedAt: timestamptz("email_verified_at"),
    appleId: text("apple_id").unique(),
    googleId: text("google_id").unique(),
    recoveryConsentAt: timestamptz("recovery_consent_at"),
    reminderConsentAt: timestamptz("reminder_consent_at"),
    recoveryConsentWithdrawnAt: timestamptz("recovery_consent_withdrawn_at"),
    reminderConsentWithdrawnAt: timestamptz("reminder_consent_withdrawn_at"),

    attachPromptDismissedAt: timestamptz("attach_prompt_dismissed_at"),

    onboardingSeenAt: timestamptz("onboarding_seen_at"),

    pushPromptDismissedAt: timestamptz("push_prompt_dismissed_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),

    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_verified_email_uq")
      .on(t.email)
      .where(isNotNull(t.emailVerifiedAt)),
  ],
);

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

    guesses: integer("guesses"),

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

    check(
      "completions_guesses_check",
      sql`(${t.game} = 'termo') = (${t.guesses} is not null)
          and (${t.guesses} is null or ${t.guesses} between 1 and 6)`,
    ),

    index("completions_user_date_idx").on(t.userId, t.date),

    index("completions_counted_date_idx")
      .on(t.date)
      .where(sql`${t.outcome} = 'won' and ${t.onTime}`),
  ],
);

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

export const hintGrants = pgTable(
  "hint_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
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

export const remoteConfig = pgTable("remote_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});
