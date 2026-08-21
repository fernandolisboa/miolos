CREATE TABLE "notification_sends" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"channel" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_sends_user_id_date_channel_pk" PRIMARY KEY("user_id","date","channel"),
	CONSTRAINT "notification_sends_channel_check" CHECK ("notification_sends"."channel" in ('push', 'email'))
);
--> statement-breakpoint
ALTER TABLE "notification_sends" ADD CONSTRAINT "notification_sends_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;