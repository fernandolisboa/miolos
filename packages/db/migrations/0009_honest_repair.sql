-- #58 (ADR-0066), migration 0009 — POST-DEPLOY: applied to Neon by the
-- merging orchestrator IMMEDIATELY AFTER the production deploy completes,
-- never before. Between 0008's apply and this one, daily rows written by
-- OLD production code carry the temporary default (`false`) where the
-- derivation says true, and new readers project the stored column — so
-- those rows read as late until this sweep promotes them (the visible
-- window ADR-0066 records; it self-heals on the next streak read).
--
-- Statement 1 is 0008's sweep verbatim, exact by construction: new code
-- never stores `false` where the derivation is true, so it touches
-- precisely the old-code-window rows; stored credits are untouched (the
-- predicate only ever promotes false -> derived-true).
UPDATE "completions" SET "on_time" = true WHERE NOT "on_time" AND ("completed_at" AT TIME ZONE 'America/Sao_Paulo')::date = "date";--> statement-breakpoint
-- From here a writer omitting the column fails loudly instead of silently
-- storing `false`: drizzle's no-default table object and T-DB-S24's
-- column-list pin cover code writers; this covers hand-written SQL.
-- DROP DEFAULT is a no-op when no default exists, so the statement is
-- individually idempotent like every other one in this repo.
ALTER TABLE "completions" ALTER COLUMN "on_time" DROP DEFAULT;
