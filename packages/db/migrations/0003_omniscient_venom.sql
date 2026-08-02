ALTER TABLE "completions" ADD COLUMN "guesses" integer;--> statement-breakpoint
ALTER TABLE "completions" ADD CONSTRAINT "completions_guesses_check" CHECK (("completions"."game" = 'termo') = ("completions"."guesses" is not null)
          and ("completions"."guesses" is null or "completions"."guesses" between 1 and 6));