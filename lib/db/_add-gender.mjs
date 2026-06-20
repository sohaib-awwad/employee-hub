// One-off migration: add the nullable `gender` column to employees and
// backfill the known seed employee. Idempotent — safe to run repeatedly.
import pg from "pg";
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender text`);

// Sohaib (the demo employee) is male, so he sees Paternity — not Maternity.
const { rowCount } = await client.query(
  `UPDATE employees SET gender = 'male' WHERE email = 'employee@example.com' AND gender IS NULL`,
);

console.log(`gender column ready. Backfilled ${rowCount} seed employee(s).`);
await client.end();
