import pg from "pg";
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
// Clear dev sample data so a NOT NULL column (password_hash) can be added,
// and so the seed can recreate everything deterministically.
await client.query(
  "TRUNCATE employees, attendance, leaves, announcements, holidays RESTART IDENTITY CASCADE",
);
console.log("Dev data cleared (employees, attendance, leaves, announcements, holidays).");
await client.end();
