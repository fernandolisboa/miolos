import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
