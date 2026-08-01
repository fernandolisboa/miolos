CREATE TABLE "daily_puzzles" (
	"game" text NOT NULL,
	"date" date NOT NULL,
	"seed" bigint NOT NULL,
	"content" jsonb NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"killed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_puzzles_game_date_pk" PRIMARY KEY("game","date"),
	CONSTRAINT "daily_puzzles_game_check" CHECK ("daily_puzzles"."game" in ('binairo', 'sudoku', 'nonogram', 'termo'))
);
--> statement-breakpoint
CREATE TABLE "remote_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
