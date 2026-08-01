CREATE TABLE "completions" (
	"user_id" uuid NOT NULL,
	"game" text NOT NULL,
	"date" date NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" text NOT NULL,
	"elapsed_ms" integer NOT NULL,
	"hints_used" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "completions_user_id_game_date_pk" PRIMARY KEY("user_id","game","date"),
	CONSTRAINT "completions_game_check" CHECK ("completions"."game" in ('binairo', 'sudoku', 'nonogram', 'termo')),
	CONSTRAINT "completions_outcome_check" CHECK ("completions"."outcome" in ('won', 'lost')),
	CONSTRAINT "completions_elapsed_ms_check" CHECK ("completions"."elapsed_ms" >= 0),
	CONSTRAINT "completions_hints_used_check" CHECK ("completions"."hints_used" >= 0)
);
--> statement-breakpoint
CREATE TABLE "hint_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"source" text NOT NULL,
	"hints" integer NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hint_grants_source_check" CHECK ("hint_grants"."source" in ('rewarded-ad')),
	CONSTRAINT "hint_grants_hints_check" CHECK ("hint_grants"."hints" > 0 and "hint_grants"."hints" <= 10)
);
--> statement-breakpoint
ALTER TABLE "completions" ADD CONSTRAINT "completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hint_grants" ADD CONSTRAINT "hint_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "completions_user_date_idx" ON "completions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "hint_grants_user_date_idx" ON "hint_grants" USING btree ("user_id","date");