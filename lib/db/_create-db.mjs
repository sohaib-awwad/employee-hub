import pg from "pg";

const { Client } = pg;

// Connect to the default maintenance DB to create our app database.
const client = new Client({
  connectionString: "postgresql://postgres:postgres@localhost:5432/postgres",
});

await client.connect();
try {
  await client.query("CREATE DATABASE employee_hub");
  console.log("Created database: employee_hub");
} catch (err) {
  if (err.code === "42P04") {
    console.log("Database employee_hub already exists — nothing to do.");
  } else {
    throw err;
  }
} finally {
  await client.end();
}
