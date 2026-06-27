import { defineConfig } from "drizzle-kit";

// Drizzle Kit config. Mirrors prisma.config.ts (schema at prisma/schema.prisma).
// After the migration to Drizzle is complete, the schema source moves to drizzle/schema.
// For the transition period we generate the initial migration from the existing Postgres.
const url = process.env.DATABASE_URL ?? "postgresql://localhost:5432/alphalead-ai";

export default defineConfig({
  schema: "./drizzle/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
