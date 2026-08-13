CREATE TABLE "attach_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"reminder_consent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "attach_prompt_dismissed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attach_tokens" ADD CONSTRAINT "attach_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attach_tokens_user_id_idx" ON "attach_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_verified_email_uq" ON "users" USING btree ("email") WHERE "users"."email_verified_at" is not null;