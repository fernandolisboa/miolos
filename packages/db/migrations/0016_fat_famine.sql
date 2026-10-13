CREATE TABLE "admin_users" (
	"email" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_check" CHECK ("admin_users"."email" = lower("admin_users"."email")),
	CONSTRAINT "admin_users_role_check" CHECK ("admin_users"."role" in ('superuser', 'admin'))
);
