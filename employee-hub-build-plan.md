# Employee Hub — Build Plan & Checklist

**Goal:** Complete the HR portal — add role-based authentication (admin + employee), a login page, and a dedicated admin dashboard, all while staying inside the existing design system.

### Locked decisions
- **Auth:** Real but lean — hashed passwords + session, a `role` column, route guards. No OAuth / refresh tokens.
- **Design system:** Adopt CSS tokens — build new code on the token utilities; keep visuals identical to the current hex. Migrating old pages is a bonus.
- **Timeline:** Flexible — polish + bonus items are in scope.

### Core narrative (for your defense)
> "The admin role closes the workflow loops the employee side leaves open — leave approvals, posting announcements, and managing staff."

---

## Phase 0 — Safety & Setup
- [ ] Commit the current working setup to git (so task work stays separate and reversible)
- [ ] (Optional) Create a branch, e.g. `feature/admin-auth`

## Phase 1 — Auth & Roles (the spine)

**Backend**
- [ ] Add `role` (`employee` | `admin`) + `passwordHash` (+ email/username if missing) to the employees schema
- [ ] Run the migration / db push
- [ ] Re-run codegen so the generated client knows the new fields
- [ ] `POST /api/auth/login` — verify with bcrypt, issue a session (httpOnly cookie recommended) or JWT
- [ ] `POST /api/auth/logout`
- [ ] `GET /api/auth/me` — returns the *logged-in* user (replaces the "first row" behavior)
- [ ] Auth middleware: `requireAuth` (sets `req.user`) and `requireAdmin` (role check)
- [ ] Replace every hard-coded `EMPLOYEE_ID = 1` with `req.user.id`
- [ ] Tighten CORS (currently wide open)

**Frontend**
- [ ] Auth context / provider (current user + role)
- [ ] Protected routes by role; redirect employee → `/dashboard`, admin → `/admin`
- [ ] Logout action in the UI

**Data**
- [ ] Seed one **admin** and one **employee** with known credentials

## Phase 2 — Login Page
- [ ] Build using existing components (`Card`, `Form`, `Input`, `Button`)
- [ ] zod-validated form + error and loading states
- [ ] Wire to `/api/auth/login` → role-based redirect
- [ ] Style with tokens (`bg-primary`, `text-foreground`, …), matching the current look

## Phase 3 — Complete the Employee Experience

**Dashboard**
- [ ] Wire "Request Correction" (creates a real request → goes to admin)
- [ ] Make the Announcements / Events tabs actually switch
- [ ] Remove or real-source the hard-coded "Break 33m" + "Remote"
- [ ] Real notification dot

**Attendance**
- [ ] Wire "Send Attendance Request" (→ admin queue)
- [ ] Wire per-row Actions (⋮)
- [ ] Real server-side pagination (replace the fake footer)

**Announcements**
- [ ] Fix the Events tab (seed events / handle the `type` correctly)
- [ ] Move priority filter + search to the backend (stop fighting pagination)

## Phase 4 — Admin Dashboard (the showcase)
- [ ] Admin layout + nav (reuse the `layout.tsx` pattern, admin routes)
- [ ] ⭐ **Leave approvals** — list pending → approve / reject endpoints → balances finally update (fixes the broken loop)
- [ ] **Announcements management** — create / edit / delete (new write endpoints)
- [ ] **Attendance overview** — all employees + handle correction / attendance requests
- [ ] **Employee management** — list / add / edit + set roles
- [ ] Build everything on the same shadcn components → consistent look, admin purpose

## Phase 5 — Polish & Defense Prep
- [ ] Design-consistency pass (tokens, spacing, interaction states)
- [ ] Responsive check
- [ ] Remove helper files (`_create-db.mjs`, `_seed.mjs`, `_verify.mjs`) if unwanted
- [ ] Write a short "what I built & why" note for submission

**Bonus (flexible timeline allows):**
- [ ] ⭐ Real dark mode — give `.dark` real values + add a theme toggle (visible creativity win)
- [ ] Migrate old pages' inline hex → tokens (full design-system consistency)

---

### Order rationale
Auth comes before finishing the employee UI because several employee fixes (correction + attendance requests) route to the admin and need real user/role context — doing auth first means wiring them once, not twice. Purely cosmetic fixes (tab switching, removing hard-coded text) can be grabbed anytime for quick momentum.
