-- #58 (ADR-0066), migration 0008 — PRE-PUSH: applied to Neon BEFORE the
-- branch's first push (previews share the production database). Hand-shaped
-- over the drizzle-generated diff, additive-only, every statement
-- individually idempotent (no transactions over neon-http; PGlite has no
-- batch).
--
-- The `DEFAULT false` is DELIBERATE AND TEMPORARY: until the production
-- deploy, old production code keeps inserting without the column, and the
-- default keeps those inserts legal. Migration 0009 (post-deploy) re-runs
-- the sweep for that window and drops the default, converging on the
-- no-default state the drizzle schema object declares.
ALTER TABLE "completions" ADD COLUMN IF NOT EXISTS "on_time" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- One-directional backfill: every pre-existing row starts at the default
-- `false`, so promoting `false -> derived-true` IS the full derivation here,
-- and the statement is re-run-safe forever — it only ever promotes, never
-- demotes, so it can never destroy a credit (a credit IS a stored `true`
-- where the derivation says false). It is 0009's sweep, the same statement,
-- deliberately (T-DB-S73 pins the equivalence).
UPDATE "completions" SET "on_time" = true WHERE NOT "on_time" AND ("completed_at" AT TIME ZONE 'America/Sao_Paulo')::date = "date";--> statement-breakpoint
-- The PK and FK ride INSIDE the CREATE so the whole statement stays
-- idempotent under IF NOT EXISTS (a separate ADD CONSTRAINT would not be).
CREATE TABLE IF NOT EXISTS "user_seen_days" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	CONSTRAINT "user_seen_days_user_id_date_pk" PRIMARY KEY("user_id","date"),
	CONSTRAINT "user_seen_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
