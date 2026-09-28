ALTER TABLE "completions" DROP CONSTRAINT "completions_game_check";--> statement-breakpoint
ALTER TABLE "daily_puzzles" DROP CONSTRAINT "daily_puzzles_game_check";--> statement-breakpoint
ALTER TABLE "completions" ADD CONSTRAINT "completions_game_check" CHECK ("completions"."game" in ('binairo', 'sudoku', 'nonogram', 'termo', 'crossword'));--> statement-breakpoint
ALTER TABLE "daily_puzzles" ADD CONSTRAINT "daily_puzzles_game_check" CHECK ("daily_puzzles"."game" in ('binairo', 'sudoku', 'nonogram', 'termo', 'crossword'));