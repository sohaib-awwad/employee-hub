import pg from "pg";
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM employees");
if (rows[0].n > 0) {
  console.log("Employees already exist — skipping seed.");
  await client.end();
  process.exit(0);
}

// Pre-computed bcrypt hashes (generated with bcryptjs, cost 10).
//   admin@example.com    / admin123
//   employee@example.com / employee123
const ADMIN_HASH = "$2a$10$QS4Y3vN6L.ws1Xy8Ip6fwumG5C7tSkfRvMFIPLLAW6G3MnoJ6jYVW";
const EMPLOYEE_HASH = "$2a$10$v53GJ..tQ5YWSlqBl2yE/.RKp4iPdOsaH4ccE/XFklKbLRTgUGfhW";

// Two accounts: one admin, one employee. Order makes the employee id 2.
const employees = [
  ["Lina Hassan", "admin@example.com", "People Ops", "HR Manager",
   "2022-01-10", "LH", "+962790000001", null, "admin", ADMIN_HASH],
  ["Sohaib Awwad", "employee@example.com", "Engineering", "Software Engineer",
   "2024-03-01", "SA", "+962790000000", "Lina Hassan", "employee", EMPLOYEE_HASH],
];
for (const e of employees) {
  await client.query(
    `INSERT INTO employees
       (name, email, department, position, join_date, avatar_initials, phone, manager_name, role, password_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    e,
  );
}

const announcements = [
  ["Quarterly All-Hands", "Join us for the Q2 all-hands meeting on June 25th in the main hall.", "Company News", "high", "event", "2026-06-14"],
  ["Updated Remote Work Policy", "The remote work policy has been updated. Please review the new guidelines.", "HR & Policies Announcements", "medium", "announcement", "2026-06-10"],
  ["New Health Insurance Plan", "Open enrollment for the new health plan starts July 1st.", "Benefits", "medium", "announcement", "2026-06-05"],
];
for (const a of announcements) {
  await client.query(
    `INSERT INTO announcements (title, body, category, priority, type, published_at)
     VALUES ($1,$2,$3,$4,$5,$6)`, a);
}

const holidays = [
  ["Independence Day", "2026-06-25", "public", "National holiday", "Thursday", 2026],
  ["Eid al-Adha", "2026-08-26", "public", "Religious holiday", "Wednesday", 2026],
  ["Christmas Day", "2026-12-25", "public", "Public holiday", "Friday", 2026],
];
for (const h of holidays) {
  await client.query(
    `INSERT INTO holidays (name, date, type, description, day_of_week, year)
     VALUES ($1,$2,$3,$4,$5,$6)`, h);
}

console.log("Seeded: 2 employees (admin + employee), 3 announcements, 3 holidays.");
console.log("  admin@example.com / admin123   (admin)");
console.log("  employee@example.com / employee123   (employee)");
await client.end();
