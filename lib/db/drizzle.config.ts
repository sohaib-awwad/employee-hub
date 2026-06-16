import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  // Relative, forward-slashed path so drizzle-kit's glob works on Windows too
  // (absolute Windows paths contain backslashes that the glob treats as escapes).
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
