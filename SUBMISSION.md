# Employee Hub — Submission Notes

A role-based HR portal ("Olive"). Employees track attendance, request leave, and
read announcements; **admins** approve leave, handle requests, manage staff, and
post announcements. This document explains **what I built, why, and how to run it.**

---

## The task

The starter project shipped a polished **employee** UI backed by an Express + Postgres
API, but it had no concept of users: every request was hardcoded to employee #1, there
was no login, and several buttons were decorative. The goal was to **complete it** —
add real role-based authentication, a login page, finish the employee experience, and
build an admin dashboard — without breaking the existing design language.

## Stack & architecture

- **Monorepo** (pnpm workspaces): `artifacts/*` (apps) + `lib/*` (shared packages).
- **Backend** — `artifacts/api-server`: Express 5, bundled with esbuild.
- **Frontend** — `artifacts/hr-portal`: React 19 + Vite, Tailwind v4, Radix/shadcn UI, wouter, TanStack Query.
- **DB** — `lib/db`: PostgreSQL via Drizzle ORM. Tables: `employees`, `attendance`, `leaves`, `holidays`, `announcements`, `requests`.
- **API contract** — `lib/api-spec/openapi.yaml` is the single source of truth. **Orval**
  generates the typed React-Query client (`lib/api-client-react`) and Zod schemas
  (`lib/api-zod`) from it. Workflow for any API change: edit the spec → `run codegen` → implement.

## What I built (by phase)

1. **Auth & roles.** Added `role` + `passwordHash` to `employees`. `POST /auth/login`
   verifies a bcrypt hash and sets a **signed, httpOnly session cookie**; `/auth/logout`
   and `/auth/me` round it out. `requireAuth` / `requireAdmin` middleware replace the
   hardcoded `EMPLOYEE_ID = 1` everywhere with `req.user.id`. CORS tightened to allow
   credentials. Frontend gained an `AuthProvider`, role-aware route guards, and logout.
2. **Login page.** react-hook-form + Zod, field + server error states, loading state,
   brand styling, role-based redirect (admin → `/admin`, employee → `/`).
3. **Completed the employee experience.** New `requests` table + endpoints; a shared
   `RequestDialog` powers "Request Correction" (dashboard + per-attendance-row) and
   "Send Attendance Request". Announcements/Events tabs now switch; priority + search
   moved server-side with real per-type counts; removed hardcoded "Break/Remote";
   data-driven notification dot; real attendance pagination.
4. **Admin dashboard.** A separate `AdminLayout` + sections: **overview**, **leave
   approvals** (approve/reject — approving updates the employee's balance, closing the
   loop the starter left open), **requests queue**, **announcements CRUD**, **employee
   management** (add/edit + assign roles), and a **today's attendance** overview. All
   endpoints are gated by `requireAdmin`.
5. **Polish.** Migrated ~280 hardcoded hex values to the CSS design tokens, then added a
   real **dark mode** (proper `.dark` palette + `next-themes` toggle in both layouts).
   Verified light/dark and mobile responsiveness.

## Key decisions (and why)

- **Session cookie, not JWT.** Signed, httpOnly cookie holding the user id — leaner than
  a session store, survives restarts, XSS-safe. (Plan locked "session, cookie recommended.")
- **`bcryptjs`, not native `bcrypt`.** The esbuild bundle externalizes native `bcrypt`
  (needs a C++ toolchain, painful on Windows). `bcryptjs` is pure JS, bundles cleanly,
  and produces standard bcrypt hashes.
- **OpenAPI-first.** Every endpoint/field change goes through the spec + codegen, so the
  client types and Zod validators never drift from the server.
- **Balance is derived, not stored.** Approving a leave just sets `status = approved`; the
  existing `/leaves/balance` already sums approved leaves, so balances update for free.
- **Design tokens + dark mode.** New code uses token utilities (`bg-background`,
  `text-foreground`, …). The token values were chosen to match the original hex, so light
  mode is visually unchanged while dark mode "just works."

## Running locally (Windows + Git Bash)

Prereqs: Node 24, pnpm, PostgreSQL on `localhost:5432`. `pnpm install` first.

`.env` (gitignored) at the repo root:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/employee_hub
COOKIE_SECRET=dev-only-change-me-7f3a9c2e1b6d4f08
```

```bash
# one-time DB setup
set -a; source .env; set +a
node lib/db/_create-db.mjs            # create the database
pnpm --filter @workspace/db run push  # create tables
node lib/db/_seed.mjs                 # seed accounts + sample data

# backend (terminal 1) — port 5000
set -a; source .env; set +a
export PORT=5000 NODE_ENV=development
pnpm --filter @workspace/api-server run build
node --enable-source-maps artifacts/api-server/dist/index.mjs

# frontend (terminal 2) — port 5173
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'
export PORT=5173 BASE_PATH=/ NODE_ENV=development
pnpm --filter @workspace/hr-portal run dev
```

Open **http://localhost:5173**.

### Demo accounts
| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@example.com` | `admin123` |
| Employee | `employee@example.com` | `employee123` |

> Windows notes: the project's scripts are POSIX (run them in Git Bash). The api-server
> `dev` script uses `export`, which pnpm runs under cmd.exe on Windows — so the backend is
> run as `build` + `node` directly. `MSYS_NO_PATHCONV=1` stops Git Bash mangling `BASE_PATH=/`.
> Windows-only native binaries (rollup/lightningcss/tailwind-oxide) are listed as
> `optionalDependencies` of `hr-portal` (skipped on Linux).

## Helper scripts (`lib/db`, dev-only)
`_create-db.mjs` (create DB), `_seed.mjs` (admin+employee+sample data), `_reset.mjs`
(truncate dev data), `_verify.mjs` (list tables). Safe to delete for production.

## Honest limitations
- Notification dot is recency-based (last 7 days), not per-user read state.
- Attendance pagination is client-side (monthly data is small); announcements paginate server-side.
- `/api/holidays` is the one remaining unauthenticated read endpoint.
- Status pills (green/amber/red) use fixed Tailwind palette colors in both themes by design.
