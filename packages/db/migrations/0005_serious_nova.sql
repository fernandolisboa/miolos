CREATE TABLE "medal_grants" (
	"user_id" uuid NOT NULL,
	"medal_id" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "medal_grants_user_id_medal_id_pk" PRIMARY KEY("user_id","medal_id"),
	CONSTRAINT "medal_grants_medal_id_check" CHECK ("medal_grants"."medal_id" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length("medal_grants"."medal_id") <= 64)
);
--> statement-breakpoint
ALTER TABLE "medal_grants" ADD CONSTRAINT "medal_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;