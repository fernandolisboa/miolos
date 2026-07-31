import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config. `db:generate` needs no database at all; `db:migrate`
 * runs against DATABASE_URL_UNPOOLED (migrations must not go through the
 * pooler). Run manually for M0 (plan 009 D9), e.g.:
 *
 *   source apps/api/.env.local && DATABASE_URL_UNPOOLED=$DATABASE_URL_UNPOOLED \
 *     pnpm --filter @miolos/db db:migrate
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: {
    // Non-null assertion: config file, fails loud at the CLI if unset —
    // exactly the behavior a migration runner should have.
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
});
