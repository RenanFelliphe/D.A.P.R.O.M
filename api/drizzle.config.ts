import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./db/migrations",
  casing: "snake_case",
  // Os `check` e os índices parciais são declarados no próprio schema.
  strict: true,
  verbose: true,
});
