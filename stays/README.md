# Jodans Bloka

Uganda property marketplace with admin/host portals, the existing app login
system, an Express API, Supabase Postgres, and Supabase Storage for photos.
Supabase Auth is not used.

## Setup

Use Node.js 22.16 or newer. In Supabase's SQL Editor, run these migrations in order:

1. `supabase/migrations/202610300001_supabase.sql`
2. `supabase/migrations/202611010001_keep_existing_login.sql`

The second migration preserves existing cloud records, removes the dependency
on Supabase Auth, and adds a backend-only password hash table. Apply it even if
you previously ran the first migration. Both can be rerun in order.

Copy `.env.example` to `.env` if it does not already exist, then set:

- `SUPABASE_URL`: your dedicated Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: a fresh backend secret or service role key. Replace
  any privileged key exposed in chat. Never put this key in a `VITE_` variable.
- `JB_SECRET`: a stable random signing secret, at least 32 characters for
  production. Generate one with `openssl rand -hex 32`. Changing it signs users out.
- `LEGACY_JB_SECRET`: the secret originally used to hash existing passwords.
  The original development app used `jodans-bloka-dev-secret`. Preserve the
  actual previous value if you had changed it. This keeps existing passwords
  working while allowing a new, strong token-signing secret.

When importing an existing local database, its admin/host accounts and password
hashes are retained. When importing only bundled property seed data, set
`BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, and `BOOTSTRAP_ADMIN_PASSWORD`
(at least 12 characters) to create an admin. Remove the bootstrap password after
import. Existing cloud passwords are never replaced by reruns.

```bash
cd stays
npm install
npm run check:supabase
npm run migrate:supabase
npm run dev
```

The import reads `server/data/db.json` if present, otherwise the bundled seed.
It preserves account IDs, login emails, roles, password hashes and listing
ownership. If an account was already imported with a cloud ID, it matches by
email and retains that cloud ID. Referenced `/uploads/` files move to the public
`property-photos` bucket. Local database and photo files remain unchanged.
Reruns insert missing records without overwriting later cloud edits. Unknown
owners and invalid/missing photos stop the import.

All app data, including credential hashes, is accessible only to the backend.
Browser roles cannot query the app tables or database functions. Public API
routes return approved listings only. Protected requests verify the app's HMAC
session token and read the current role and active status from the database.
New passwords use scrypt; existing salted SHA-256 hashes remain supported.
Registration always creates a host, regardless of request-supplied roles.

The frontend does not require Supabase public keys, Auth redirects or SMTP.
The email/password sign-in and host registration screens use the existing API.
No Supabase Auth accounts or emails are created by import or registration.

## Run and deploy

| Surface | Local URL |
| --- | --- |
| Marketplace | http://localhost:5173/ |
| Backend hub | http://localhost:5173/backend |
| Admin login | http://localhost:5173/admin/login |
| Host login | http://localhost:5173/host/login |
| API health | http://localhost:4000/api/health |

Build and run the combined frontend/API service from `stays/`:

```bash
npm install
npm run build
npm start
```

The production server serves `dist/` and API routes from one origin. Set
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JB_SECRET`, `LEGACY_JB_SECRET` (for
imported legacy hashes), and the host-assigned `PORT`. `WEB_ORIGIN` can restrict
browser access to your frontend origin. No persistent local disk is needed for
normal operation once the import is complete.

For separate frontend/API hosting, publish `dist/` with an `index.html` fallback
and set `VITE_API_URL` to the API's HTTPS origin without `/api` before building.
For combined hosting, leave it empty. `VITE_PLATFORM_URL` configures the link to
the main real estate site; `VITE_HOMES_URL` defaults to the current frontend
origin. Rebuild after changing a `VITE_` value. A static host cannot run Express.

Dashboard calculations currently read a consistent database snapshot. Only
changed records are committed, atomically; overlapping edits return HTTP 409.
Large datasets will need query-level pagination and SQL analytics.

## Validation

```bash
npm run build
npm run lint
npm test
npm run check:supabase
```

Integration tests start an isolated temporary PostgreSQL instance. They require
`initdb`, `pg_ctl`, and `psql` on PATH (otherwise they report a skip). They verify
schema upgrades, existing-password login, role/ownership restrictions,
moderation, transaction conflicts, and safe import reruns. Storage is mocked;
a live database check and a real login/upload check are still needed after
supplying the fresh backend key and applying both SQL migrations.
