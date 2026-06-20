// One-off migration: create the `breaks` table. Idempotent — safe to re-run.
import pg from "pg";
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS breaks (
    id         serial PRIMARY KEY,
    employee_id integer NOT NULL,
    date       text NOT NULL,
    start_time text NOT NULL,
    end_time   text,
    created_at timestamp NOT NULL DEFAULT now()
  )
`);

console.log("breaks table ready.");
await client.end();
