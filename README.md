# Employee Hub — "Olive"

A role-based HR portal where **employees** track attendance, take breaks, request
leave, and read announcements, and **admins** manage staff, approve leave and
correction requests, post announcements, and export per-employee attendance
reports as PDF.

> Built as a full-stack TypeScript monorepo with an **OpenAPI-first** workflow:
> the API contract is the single source of truth, and the typed React-Query
> client and Zod validators are generated from it.

**Live demo:** https://employee-hub-a6dy.onrender.com
_(free hosting — the first load after a while may take ~30–50s to wake)._

### Demo accounts

| Role     | Email                  | Password      |
| -------- | ---------------------- | ------------- |
| Admin    | `admin@example.com`    | `admin123`    |
| Employee | `employee@example.com` | `employee123` |

---

## Features

**Employee**
- Email/password login with a signed session cookie.
- Dashboard with today's status, hours, and quick actions.
- Attendance: punch in / punch out, break tracking, and a **12-hour daily cap**
  that auto-closes a shift left running past the limit.
- Leave requests with a live balance, plus correction/attendance requests.
- Announcements feed.

**Admin**
- Admin overview dashboard.
- Employee directory with search and pagination.
- Request queue: **Approve opens a correction modal** that sets the employee's
  work window for the day and writes the corrected attendance record; Reject.
- Leave approval.
- **Per-employee attendance PDF export** over an admin-chosen date range
  (clamped to the employee's join date and today), with working days, days
  worked, holidays, and leave-balance consumption.
- Announcement posting.

## Tech stack

- **Monorepo:** pnpm workspaces, TypeScript 5.9, Node.js.
- **Backend** (`artifacts/api-server`): Express 5, Pino logging, cookie-based
  sessions, bcrypt password hashing.
- **Database** (`lib/db`): PostgreSQL via Drizzle ORM (`node-postgres`).
- **Frontend** (`artifacts/hr-portal`): React 19 + Vite, Tailwind CSS v4,
  Radix/shadcn UI, wouter routing, TanStack Query.
- **API contract** (`lib/api-spec`): OpenAPI 3 → **Orval** codegen → typed
  React-Query client (`lib/api-client-react`) + Zod schemas (`lib/api-zod`).
- **PDF:** jsPDF + jspdf-autotable.

## Repository layout

```
artifacts/
  api-server/     Express API (mounted at /api)
  hr-portal/      React + Vite single-page app
lib/
  db/             Drizzle schema, migrations, DB client
  api-spec/       OpenAPI spec — the source of truth; runs codegen
  api-client-react/  Generated typed React-Query hooks (do not edit by hand)
  api-zod/        Generated Zod schemas (do not edit by hand)
```

## Getting started

**Prerequisites:** Node.js, [pnpm](https://pnpm.io/) (this repo enforces pnpm),
and a PostgreSQL database.

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
#   then edit .env — set DATABASE_URL and COOKIE_SECRET

# 3. Create the database schema
pnpm --filter @workspace/db run push

# 4. (Optional) Seed a realistic demo dataset — roster, ~9 weeks of
#    attendance, leave, requests, holidays, announcements.
#    NOTE: this resets every table before inserting.
pnpm --filter @workspace/db run seed

# 5. Run the API (port 5000) and the frontend (Vite) in two terminals
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/hr-portal run dev
```

The frontend calls the API at the relative path `/api`; in dev the Vite dev
server proxies `/api` to the API (`API_PROXY_TARGET`, default
`http://localhost:5000`).

### Useful scripts

```bash
pnpm run typecheck                          # full typecheck across the monorepo
pnpm run build                              # typecheck + build every package
pnpm --filter @workspace/api-spec run codegen   # regenerate client + Zod from the OpenAPI spec
```

## How an API change flows

The OpenAPI spec is the contract. To add or change an endpoint:

1. Edit `lib/api-spec/openapi.yaml`.
2. Run `pnpm --filter @workspace/api-spec run codegen` — this regenerates the
   React-Query hooks (`lib/api-client-react`) and Zod schemas (`lib/api-zod`).
3. Implement the route in `artifacts/api-server/src/routes/` to match the spec.
4. Consume the generated hook in the frontend (`artifacts/hr-portal/src`).

## Deployment

The app deploys as a **single service**: in production the Express server also
serves the built React SPA, so the frontend and API share one origin and one
URL. See **[DEPLOYMENT.md](DEPLOYMENT.md)** for a step-by-step guide to a free
deploy on Render + Neon Postgres ([`render.yaml`](render.yaml) is included).

## License

MIT
