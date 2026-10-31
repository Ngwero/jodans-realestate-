# Jodans Bloka

Uganda property marketplace with admin/host portals, an Express API, Supabase
Postgres, Supabase Auth, and Supabase Storage.

## Set up Supabase

Use Node.js 22.16 or newer.

1. In the Supabase dashboard, open **SQL Editor** and run
   [`supabase/migrations/202610300001_supabase.sql`](supabase/migrations/202610300001_supabase.sql).
   This creates the app tables, a profile trigger, backend-only database functions,
   and a public `property-photos` bucket. It is safe to rerun.
2. Copy `.env.example` to `.env` if it does not already exist. Set:
   - `VITE_SUPABASE_URL` and `SUPABASE_URL`: the project URL.
   - `VITE_SUPABASE_ANON_KEY`: the public publishable key or legacy anon key.
   - `SUPABASE_SERVICE_ROLE_KEY`: a **fresh backend secret key** (`sb_secret_…`)
     or service role key. Revoke/replace previously exposed privileged keys.
   - `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, and
     `BOOTSTRAP_ADMIN_PASSWORD`: your real admin account. Choose a password of at
     least 12 characters. Never reuse the former demo passwords.
3. Under **Authentication → URL Configuration**, set your frontend Site URL and
   allow the exact redirect URLs `http://localhost:5173/host/login` and
   `http://localhost:5173/reset-password` for local development. Add the equivalent
   URLs for your deployed frontend. Enable email/password login, keep email
   confirmation enabled, and configure production SMTP before accepting real users.
4. From `stays/`, run:

   ```bash
   npm install
   npm run check:supabase
   npm run migrate:supabase
   npm run dev
   ```

   The check is read-only. The import creates/promotes the explicitly configured
   admin, maps existing accounts by email, imports listings and activity, and
   uploads referenced `/uploads/` photos to Storage. If there is no local
   `server/data/db.json`, it imports the bundled property seed instead. Seed/demo
   ownership moves to the bootstrap admin; no demo logins are created.
5. Remove `BOOTSTRAP_ADMIN_PASSWORD` from `.env` after a successful import.

Keep local credentials in the Git-ignored `.env`.
No backend secret is needed by the browser. Never give a `VITE_` variable a
privileged key; all `VITE_` values are public in the frontend build.

## Accounts and import behavior

- Supabase Auth handles passwords, email confirmation, session refresh and reset.
  Signup creates a host profile. Metadata cannot grant admin access.
- Admin/host roles and active status are checked by the API on every protected
  request. Public endpoints return approved listings only.
- Existing local password hashes cannot be converted to Supabase passwords.
  Imported hosts must use **Forgot password?** to set a new password. The import
  script sends no emails; the user initiates recovery from the login form.
- If the bootstrap email already exists in Supabase, the import preserves its
  password and explicitly grants that account admin access.
- The import preserves local files and inserts missing listings/activity only.
  It can be rerun after interruption without overwriting later cloud edits.
  It preserves previously uploaded photos. Unknown owners, missing local photos,
  and photos over 8 MB stop the import; correct the local data and rerun.
- Other admins can be assigned by a trusted operator in Supabase by changing
  `app_profiles.role`. Browser users have no direct access to the app tables or
  database functions. All app data access goes through the Express API.

## Run and deploy

### Railway: website and API in one service

Set the service Root Directory to `stays`, Build Command to `npm run build`,
and Start Command to `npm start`. The production server listens on Railway's
`PORT` and serves both `dist/` and `/api`, including SPA navigation fallbacks.
Use `/api/health` as the deployment healthcheck.

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as server variables. Set
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` before building. Set `WEB_ORIGIN`
to `https://jodansconcepts.com`. Leave `VITE_API_URL`, `VITE_PLATFORM_URL`, and
`VITE_HOMES_URL` unset for links and API requests on the current domain.
Never use a localhost URL in production variables or expose the service-role key
through a `VITE_` variable. The Supabase migration must be installed before startup.

```bash
cd stays
npm install
npm run dev
```

| Surface | Local URL |
| --- | --- |
| Marketplace | http://localhost:5173/ |
| Backend hub | http://localhost:5173/backend |
| Admin login | http://localhost:5173/admin/login |
| Host login | http://localhost:5173/host/login |
| API health | http://localhost:4000/api/health |

Frontend: build with `npm run build`, publish `dist/`, and configure a fallback to
`index.html` for routes such as `/host/login` and `/reset-password`.

Backend: deploy this Node service separately with start command
`node server/index.js` from `stays/`. Set `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, the host-assigned `PORT`, and `WEB_ORIGIN` to the
frontend origin. Data and uploaded photos persist in Supabase; a local disk is
not required for normal operation.

Set `VITE_API_URL` to the backend's HTTPS origin **without `/api`** before building
if the API is on another origin. Leave it empty when `/api` is reverse-proxied to
the backend. Set `VITE_PLATFORM_URL` to the main real estate site's public URL;
`VITE_HOMES_URL` defaults to the current frontend origin. Rebuild whenever a
`VITE_` value changes. A static frontend host alone cannot run the Express API.

The API retains the existing in-memory dashboard calculations, reading a
consistent database snapshot and committing only changed records atomically.
Conflicting edits return HTTP 409 so the user can reload. Large datasets will
need query-level pagination and SQL analytics as the marketplace grows.

## Validation

```bash
npm run build
npm run lint
npm test
npm run check:supabase
```

The integration tests start a temporary isolated PostgreSQL instance, apply the
schema twice, and check role boundaries, moderation, ownership and transaction
conflicts. They require PostgreSQL's `initdb`, `pg_ctl`, and `psql` on PATH; tests
report a skip if those tools are unavailable. Auth verification and Storage
responses are mocked; a live project check and a real signup/login/upload smoke
test are still required after supplying the fresh key and applying the migration.
