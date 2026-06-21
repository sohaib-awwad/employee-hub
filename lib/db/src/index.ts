import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const rawUrl = process.env.DATABASE_URL;

// We set TLS explicitly below, so drop any `sslmode` from the URL — leaving it
// in makes the pg driver log a (harmless) deprecation warning about how
// `require` is interpreted. Only the query string is touched; the credentials
// and host are left exactly as-is.
function stripSslmode(url: string): string {
  const q = url.indexOf("?");
  if (q === -1) return url;
  const params = new URLSearchParams(url.slice(q + 1));
  params.delete("sslmode");
  const rest = params.toString();
  return rest ? `${url.slice(0, q)}?${rest}` : url.slice(0, q);
}

const connectionString = stripSslmode(rawUrl);

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
