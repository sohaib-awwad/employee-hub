// Demo seed for Employee Hub ("Olive").
//
// Populates a realistic, deterministic dataset: a staff roster across
// departments, ~9 weeks of attendance + breaks, leave records (a mix of
// types/statuses), a live admin request queue, holidays, and announcements.
//
// This RESETS the database (truncates every table) before inserting, so the
// result is the same every time — ideal for a demo / portfolio deployment.
//
//   DATABASE_URL=... node lib/db/seed.mjs
//   pnpm --filter @workspace/db run seed
//
// Demo logins (all non-admin accounts share the employee password):
//   admin@example.com    / admin123      (admin)
//   employee@example.com / employee123   (employee)  + every other @example.com

import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// ── Deterministic RNG (mulberry32) so the dataset is identical every run ──────
let _s = 0x9e3779b9;
function rng() {
  _s |= 0;
  _s = (_s + 0x6d2b79f5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

// ── Date helpers (work in local time, yyyy-mm-dd) ─────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6; // Sun/Sat
const hhmm = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
const addDays = (d, n) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

const today = new Date();
today.setHours(0, 0, 0, 0);
const WINDOW_DAYS = 63; // ~9 weeks of history
const windowStart = addDays(today, -WINDOW_DAYS);

// Pre-computed bcrypt hashes (bcryptjs, cost 10).
const ADMIN_HASH = "$2a$10$QS4Y3vN6L.ws1Xy8Ip6fwumG5C7tSkfRvMFIPLLAW6G3MnoJ6jYVW"; // admin123
const EMPLOYEE_HASH = "$2a$10$v53GJ..tQ5YWSlqBl2yE/.RKp4iPdOsaH4ccE/XFklKbLRTgUGfhW"; // employee123

// ── Reset ─────────────────────────────────────────────────────────────────────
console.log("Resetting tables…");
await client.query(
  `TRUNCATE attendance, breaks, leaves, requests, announcements, holidays, employees RESTART IDENTITY CASCADE`,
);

// ── Employees ─────────────────────────────────────────────────────────────────
// [name, email, department, position, joinDate, gender, initials, phone, managerName, role, hash]
const employees = [
  ["Lina Hassan", "admin@example.com", "People Ops", "Head of People", "2021-02-15", "female", "LH", "+962790000001", null, "admin", ADMIN_HASH],
  ["Sohaib Awwad", "employee@example.com", "Engineering", "Software Engineer", "2024-03-01", "male", "SA", "+962790000002", "Omar Khalil", "employee", EMPLOYEE_HASH],
  ["Omar Khalil", "omar.khalil@example.com", "Engineering", "Engineering Manager", "2022-06-10", "male", "OK", "+962790000003", "Lina Hassan", "employee", EMPLOYEE_HASH],
  ["Maya Haddad", "maya.haddad@example.com", "Design", "Product Designer", "2023-09-05", "female", "MH", "+962790000004", "Lina Hassan", "employee", EMPLOYEE_HASH],
  ["Yousef Nasser", "yousef.nasser@example.com", "Sales", "Account Executive", "2023-01-20", "male", "YN", "+962790000005", "Lina Hassan", "employee", EMPLOYEE_HASH],
  ["Rana Saleh", "rana.saleh@example.com", "Marketing", "Marketing Specialist", "2024-11-12", "female", "RS", "+962790000006", "Lina Hassan", "employee", EMPLOYEE_HASH],
  ["Karim Mansour", "karim.mansour@example.com", "Accounting", "Senior Accountant", "2022-03-18", "male", "KM", "+962790000007", "Lina Hassan", "employee", EMPLOYEE_HASH],
  ["Dana Ibrahim", "dana.ibrahim@example.com", "Product", "Product Manager", "2023-05-02", "female", "DI", "+962790000008", "Lina Hassan", "employee", EMPLOYEE_HASH],
  ["Tariq Aziz", "tariq.aziz@example.com", "Engineering", "QA Engineer", "2025-12-01", "male", "TA", "+962790000009", "Omar Khalil", "employee", EMPLOYEE_HASH],
];
const empIds = {}; // email -> id
for (const e of employees) {
  const { rows } = await client.query(
    `INSERT INTO employees
       (name, email, department, position, join_date, gender, avatar_initials, phone, manager_name, role, password_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    e,
  );
  empIds[e[1]] = rows[0].id;
}
const ADMIN = "Lina Hassan";
const id = (email) => empIds[email];

// ── Holidays (2026) ───────────────────────────────────────────────────────────
const holidays = [
  ["New Year's Day", "2026-01-01", "public", "Public holiday"],
  ["Labour Day", "2026-05-01", "public", "International Workers' Day"],
  ["Independence Day", "2026-05-25", "public", "National holiday"],
  ["Eid al-Adha", "2026-05-27", "public", "Religious holiday"],
  ["Islamic New Year", "2026-06-16", "public", "Religious holiday"],
  ["Prophet's Birthday", "2026-09-04", "public", "Religious holiday"],
  ["Christmas Day", "2026-12-25", "public", "Public holiday"],
];
const holidaySet = new Set(holidays.map((h) => h[1]));
for (const [name, date, type, description] of holidays) {
  await client.query(
    `INSERT INTO holidays (name, date, type, description, day_of_week, year)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [name, date, type, description, DOW[new Date(date).getDay()], 2026],
  );
}

// ── Announcements ─────────────────────────────────────────────────────────────
const ann = (days) => fmt(addDays(today, days));
const announcements = [
  ["Q2 All-Hands Meeting", "Join us for the company-wide Q2 all-hands this Thursday at 10:00 in the main hall. We'll cover roadmap, hiring, and Q3 goals.", "Company News", "high", "event", ann(2)],
  ["Summer Team Retreat", "Our annual team retreat is at the Dead Sea resort on July 18–19. Sign up by July 5th.", "Company News", "medium", "event", ann(8)],
  ["Updated Remote Work Policy", "The remote work policy has been refreshed — up to two remote days per week with manager approval. Please review the handbook.", "HR & Policies Announcements", "medium", "announcement", ann(-3)],
  ["New Health Insurance Plan", "Open enrollment for the upgraded health plan begins July 1st, with expanded dental and vision coverage.", "Benefits", "medium", "announcement", ann(-6)],
  ["Lunch & Learn: AI in the Workplace", "A 45-minute session on practical AI tooling, this Wednesday at 13:00. Lunch provided.", "Learning", "low", "event", ann(1)],
  ["Office Closed for Islamic New Year", "A reminder that the office will be closed June 16th for the public holiday. Enjoy the day off!", "HR & Policies Announcements", "low", "announcement", ann(-9)],
];
for (const a of announcements) {
  await client.query(
    `INSERT INTO announcements (title, body, category, priority, type, published_at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    a,
  );
}

// ── Leaves ────────────────────────────────────────────────────────────────────
// [email, type, start, end, days, status, reason, approvedBy|null]
const leaves = [
  ["employee@example.com", "annual", "2026-05-18", "2026-05-22", 5, "approved", "Family trip abroad.", ADMIN],
  ["employee@example.com", "annual", "2026-07-06", "2026-07-10", 5, "pending", "Planned summer vacation.", null],
  ["maya.haddad@example.com", "sick", "2026-06-08", "2026-06-09", 2, "approved", "Flu — doctor's note attached.", ADMIN],
  ["omar.khalil@example.com", "casual", "2026-06-15", "2026-06-15", 1, "approved", "Personal errand.", ADMIN],
  ["karim.mansour@example.com", "unpaid", "2026-05-28", "2026-05-28", 1, "approved", "Family matter.", ADMIN],
  ["yousef.nasser@example.com", "annual", "2026-06-12", "2026-06-13", 2, "rejected", "Long weekend.", ADMIN],
  ["tariq.aziz@example.com", "paternity", "2026-06-17", "2026-06-19", 3, "approved", "Newborn — paternity leave.", ADMIN],
  ["rana.saleh@example.com", "maternity", "2026-09-01", "2026-11-09", 50, "pending", "Maternity leave request.", null],
  ["dana.ibrahim@example.com", "annual", "2026-06-29", "2026-07-03", 5, "pending", "Upcoming holiday.", null],
  ["maya.haddad@example.com", "other", "2026-04-14", "2026-04-14", 1, "approved", "Bereavement.", ADMIN],
];
// Build per-employee set of APPROVED leave dates (to skip in attendance gen).
const onLeave = {}; // id -> Set(dateStr)
for (const [email, type, start, end, days, status, reason, approvedBy] of leaves) {
  await client.query(
    `INSERT INTO leaves (employee_id, type, start_date, end_date, days, status, reason, approved_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id(email), type, start, end, days, status, reason, approvedBy],
  );
  if (status === "approved") {
    const set = (onLeave[id(email)] ??= new Set());
    for (let d = new Date(start); d <= new Date(end); d = addDays(d, 1)) set.add(fmt(d));
  }
}

// ── Requests (admin queue) ────────────────────────────────────────────────────
// [email, type, date|null, reason, status]
const requests = [
  ["employee@example.com", "correction", "2026-06-17", "Forgot to punch out — the system still shows me clocked in for that day.", "pending"],
  ["maya.haddad@example.com", "correction", "2026-06-16", "My punch-in time is wrong, I actually started at 08:30.", "pending"],
  ["yousef.nasser@example.com", "attendance", null, "Please enable remote attendance for my client visit days.", "pending"],
  ["karim.mansour@example.com", "correction", "2026-06-11", "I was on-site at the bank all morning; attendance wasn't recorded.", "pending"],
  ["omar.khalil@example.com", "correction", "2026-06-05", "Worked late on the release; please correct my hours.", "approved"],
  ["tariq.aziz@example.com", "attendance", null, "Requesting a fixed schedule for QA shifts.", "rejected"],
];
for (const [email, type, date, reason, status] of requests) {
  await client.query(
    `INSERT INTO requests (employee_id, type, date, reason, status)
     VALUES ($1,$2,$3,$4,$5)`,
    [id(email), type, date, reason, status],
  );
}

// ── Attendance + breaks ───────────────────────────────────────────────────────
// One row per worked weekday in the window, skipping weekends, holidays, and
// approved-leave days. Mostly present, with occasional half-days and absences.
let attCount = 0;
let breakCount = 0;
const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

for (const e of employees) {
  const eid = id(e[1]);
  const joined = new Date(e[4]);
  const leaveSet = onLeave[eid] ?? new Set();

  for (let d = new Date(windowStart); d <= today; d = addDays(d, 1)) {
    if (isWeekend(d)) continue;
    if (d < joined) continue; // not employed yet
    const ds = fmt(d);
    if (holidaySet.has(ds)) continue;
    if (leaveSet.has(ds)) continue;

    const isToday = ds === fmt(today);

    // A live, in-progress shift for one employee today (shows the running
    // timer and the 12-hour cap feature) — only if punched in < 12h ago.
    if (isToday && e[1] === "employee@example.com" && nowMin >= 9 * 60) {
      const inMin = Math.max(9 * 60, nowMin - randInt(90, 180));
      await client.query(
        `INSERT INTO attendance (employee_id, date, punch_in, punch_out, status, hours_worked, note)
         VALUES ($1,$2,$3,NULL,'present',NULL,NULL)`,
        [eid, ds, hhmm(inMin)],
      );
      attCount++;
      continue;
    }

    const roll = rng();
    if (roll < 0.05) {
      // Absent
      await client.query(
        `INSERT INTO attendance (employee_id, date, status, hours_worked)
         VALUES ($1,$2,'absent',0)`,
        [eid, ds],
      );
      attCount++;
    } else if (roll < 0.12) {
      // Half day
      const inMin = randInt(8 * 60 + 50, 9 * 60 + 10);
      const outMin = randInt(12 * 60 + 45, 13 * 60 + 15);
      const hours = Math.round(((outMin - inMin) / 60) * 10) / 10;
      await client.query(
        `INSERT INTO attendance (employee_id, date, punch_in, punch_out, status, hours_worked, note)
         VALUES ($1,$2,$3,$4,'half_day',$5,'Half day')`,
        [eid, ds, hhmm(inMin), hhmm(outMin), hours],
      );
      attCount++;
    } else {
      // Present, full day with a lunch break
      const inMin = randInt(8 * 60 + 48, 9 * 60 + 15);
      const outMin = randInt(17 * 60 + 5, 18 * 60 + 20);
      const brkStart = randInt(12 * 60 + 15, 13 * 60);
      const brkLen = randInt(30, 60);
      const brkEnd = brkStart + brkLen;
      const hours = Math.round(((outMin - inMin - brkLen) / 60) * 10) / 10;
      await client.query(
        `INSERT INTO attendance (employee_id, date, punch_in, punch_out, status, hours_worked)
         VALUES ($1,$2,$3,$4,'present',$5)`,
        [eid, ds, hhmm(inMin), hhmm(outMin), hours],
      );
      attCount++;
      await client.query(
        `INSERT INTO breaks (employee_id, date, start_time, end_time) VALUES ($1,$2,$3,$4)`,
        [eid, ds, hhmm(brkStart), hhmm(brkEnd)],
      );
      breakCount++;
    }
  }
}

console.log("\nSeeded:");
console.log(`  ${employees.length} employees (1 admin, ${employees.length - 1} staff)`);
console.log(`  ${holidays.length} holidays, ${announcements.length} announcements`);
console.log(`  ${leaves.length} leave records, ${requests.length} requests`);
console.log(`  ${attCount} attendance rows, ${breakCount} breaks`);
console.log("\nLogins:");
console.log("  admin@example.com    / admin123");
console.log("  employee@example.com / employee123   (all staff use employee123)");

await client.end();
