# Deploying Employee Hub for free

This guide deploys the whole app — API **and** frontend — as **one free web
service on [Render](https://render.com)**, backed by a **free
[Neon](https://neon.tech) Postgres** database. No credit card required.

**Cost:** $0. **Trade-off:** the free Render service sleeps after ~15 min of
inactivity, so the *first* visit after idle takes ~30–50s to wake up. Every
visit after that is instant. The Neon database is always-on and persistent.

You'll do this once and end up with a public link like
`https://employee-hub.onrender.com`.

---

## How it fits together

```
  Browser ──HTTPS──▶  Render web service  ──▶  Neon Postgres
                      (Express serves the          (your data)
                       React SPA + /api)
```

The Express server serves the built React app and the `/api` routes from the
same origin, so there's only one service and one URL to manage.

---

## Step 1 — Create the database (Neon)

1. Go to [neon.tech](https://neon.tech) and sign up (use **Sign in with
   GitHub**).
2. Create a new project (any name, e.g. `employee-hub`). Pick a region close to
   you.
3. On the project dashboard, find **Connection string** and copy it. It looks
   like:
   ```
   postgresql://USER:PASSWORD@ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=require
   ```
   Keep `?sslmode=require` at the end — it's required. Save this string; you'll
   use it twice.

## Step 2 — Load the schema + demo data into Neon (one time, from your PC)

From the project folder, point the DB tools at your Neon string and run the
schema push + seed. In **PowerShell**:

```powershell
$env:DATABASE_URL = "postgresql://USER:PASSWORD@ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=require"
pnpm --filter @workspace/db run push    # creates the tables
pnpm --filter @workspace/db run seed     # fills in the demo data
```

(When `push` asks to create the tables, accept.) When it finishes you should
see `Seeded: 9 employees …`. Your Neon database is now ready.

> The seed **resets** all tables every time it runs — only run it when you want
> a fresh demo dataset.

## Step 3 — Deploy the web service (Render)

1. Make sure your latest code is pushed to GitHub (this branch already is).
2. Go to [render.com](https://render.com) and sign up with **GitHub**.
3. Click **New ▸ Blueprint**, pick your `employee-hub` repository, and choose
   this branch. Render reads [`render.yaml`](render.yaml) and sets up a free web
   service automatically.
   - *Prefer clicking instead?* Use **New ▸ Web Service** and enter the values
     from `render.yaml` by hand:
     - **Build command:**
       `corepack enable && pnpm install --frozen-lockfile && PORT=10000 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/hr-portal run build && pnpm --filter @workspace/api-server run build`
     - **Start command:** `node artifacts/api-server/dist/index.mjs`
     - **Instance type:** Free
4. When prompted for environment variables, set:
   - `DATABASE_URL` → your Neon connection string from Step 1.
   - `NODE_ENV` → `production` (already in the blueprint).
   - `COOKIE_SECRET` → leave it; Render generates a secure value.
5. Click **Deploy**. The first build takes a few minutes.

## Step 4 — Open it

Visit the URL Render gives you (e.g. `https://employee-hub.onrender.com`) and
log in:

| Role     | Email                  | Password      |
| -------- | ---------------------- | ------------- |
| Admin    | `admin@example.com`    | `admin123`    |
| Employee | `employee@example.com` | `employee123` |

Then add the link to the README's "Live demo" line and to your portfolio.

---

## Day-to-day

- **Updating the app:** push to the branch on GitHub → Render rebuilds and
  redeploys automatically. Your data in Neon is untouched.
- **Resetting the demo data:** re-run the Step 2 `seed` command from your PC.
- **Custom subdomain:** rename the service in Render to change the
  `*.onrender.com` prefix.

## Troubleshooting

- **Login works but immediately logs out / "not authenticated":** make sure
  `NODE_ENV=production` is set (the session cookie is marked `secure`, which
  needs the HTTPS that Render provides).
- **DB connection errors:** confirm `DATABASE_URL` is the full Neon string
  *including* `?sslmode=require`.
- **`push` seems to hang:** in Neon, try the **direct** (non-pooled) connection
  string for the one-time `push`/`seed`.
- **Build fails on a missing native binary:** rare; it means a platform package
  was pruned. Re-run the deploy, or open an issue — the Linux x64 binaries are
  the ones Render uses and are kept in the lockfile.
