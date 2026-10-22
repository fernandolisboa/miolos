ALTER TABLE "users" ADD COLUMN "telemetry_opt_out_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "game_settings" jsonb;