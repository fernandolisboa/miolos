CREATE TABLE "consent_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"consent" text NOT NULL,
	"action" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consent_events_consent_check" CHECK ("consent_events"."consent" in ('recovery', 'reminder')),
	CONSTRAINT "consent_events_action_check" CHECK ("consent_events"."action" in ('granted', 'withdrawn'))
);
--> statement-breakpoint
ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_events_user_id_idx" ON "consent_events" USING btree ("user_id");--> statement-breakpoint
INSERT INTO "consent_events" ("user_id", "consent", "action", "at")
SELECT "id", 'recovery', 'granted', "recovery_consent_at" FROM "users" u
WHERE "recovery_consent_at" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "consent_events" e WHERE e."user_id" = u."id" AND e."consent" = 'recovery')
UNION ALL
SELECT "id", 'reminder', 'granted', "reminder_consent_at" FROM "users" u
WHERE "reminder_consent_at" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "consent_events" e WHERE e."user_id" = u."id" AND e."consent" = 'reminder');