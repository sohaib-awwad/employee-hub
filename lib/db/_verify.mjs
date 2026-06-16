import pg from "pg";
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
);
console.log("Tables in employee_hub:");
for (const r of rows) console.log("  -", r.table_name);
await client.end();
