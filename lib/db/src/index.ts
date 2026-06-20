import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;

// Managed Postgres providers (Neon, Render, Supabase, …) require TLS, while a
// local dev database does not. Enable SSL automatically unless we're talking
// to localhost. rejectUnauthorized:false avoids self-signed-chain errors that
// some providers' certificates trigger in Node's default trust store.
const isLocal = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(connectionString);

export const pool = new Pool({
  connectionString,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });

export * from "./schema";
