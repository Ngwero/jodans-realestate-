# Jodans Bloka

Uganda property marketplace with admin/host portals, the existing app login
system, an Express API, Supabase Postgres, and Supabase Storage for photos.
Supabase Auth is not used.

## Setup

Use Node.js 22.16 or newer. In Supabase's SQL Editor, run these migrations in order:

1. `supabase/migrations/202610300001_supabase.sql`
2. `supabase/migrations/202611010001_keep_existing_login.sql`
3. `supabase/migrations/202611010002_account_emails.sql`

The second migration preserves existing cloud records, removes the dependency
on Supabase Auth, and adds a backend-only password hash table. Apply it even if
you previously ran the first migration. All migrations can be rerun in order.

Copy `.env.example` to `.env` if it does not already exist, then set:

- `SUPABASE_URL`: your dedicated Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: a fresh backend secret or service role key. Replace
  any privileged key exposed in chat. Never put this key in a `VITE_` variable.
- `JB_SECRET`: optional explicit signing secret, at least 32 characters for
  production. Generate one with `openssl rand -hex 32`. When omitted, the app
  derives a separate signing key from the existing backend Supabase secret using
  HKDF. Rotating that backend key then signs users out. Replicas must use the same
  settings; never use a public/anon key as the backend secret.
- `LEGACY_JB_SECRET`: the secret originally used to hash existing passwords.
  The original development app used `jodans-bloka-dev-secret`. Preserve the
  actual previous value if you had changed it. If both legacy and explicit
  signing settings are omitted, original development hashes remain supported.
  This keeps existing passwords
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
Registration always creates an unverified host, regardless of request-supplied roles. New hosts must confirm their email before signing in. Existing imported accounts remain verified.

The frontend does not require Supabase public keys or Auth redirects. SMTP settings belong only on the backend.
The email/password sign-in and host registration screens use the existing API.
No Supabase Auth accounts are created. Registration sends an email confirmation through the app’s configured SMTP service.

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

## Account emails

The app supports confirmation emails, forgotten-password recovery, and a password-change
notice. Configure the existing Jodans noreply mailbox on the backend:

```env
APP_URL=https://www.jodansconcepts.com
MAIL_FROM="Jodans Concepts <noreply@jodansconcepts.com>"
SMTP_HOST=mail.jodansconcepts.com
SMTP_PORT=465
SMTP_USER=noreply@jodansconcepts.com
SMTP_PASSWORD=your-mailbox-password
```

Use the mailbox’s actual SMTP login if it differs. The password is server-only.
Supabase’s saved SMTP password is hidden in its dashboard; the separate Express
service needs the same credential configured in its own environment. Do not
post credentials in chat or commit `.env`. Port 465 uses TLS; port 587 requires
STARTTLS with certificate verification enabled. For local UI tests, set APP_URL
to the local frontend origin. Never derive email links from request Host headers.

Apply migration 3 before deploying this version. It preserves existing accounts
and adds private token, delivery-queue, and rate-limit tables. Missing SMTP
configuration leaves existing login working and returns an explicit temporary
unavailable response for new signups and recovery requests. It never claims to
have sent an email when no provider is configured.

Verification links expire after 24 hours; password-reset links after 30 minutes.
Links are single-use and newer requests replace older links. Successful resets
revoke existing app sessions. Tokens are stored only as hashes; queued message
payloads containing links are encrypted with a separate key derived from the
backend secret. All replicas must use the same backend secret (or explicit
MAIL_ENCRYPTION_SECRET). Rotating that key makes old pending mail unreadable;
users can request new links afterward.

The database-backed queue retries delivery up to six times with backoff and uses
leases to prevent simultaneous workers from claiming the same message. SMTP may
deliver a duplicate if a process crashes after sending and before acknowledging;
links remain safe to use only once. Requests are rate limited without exposing
whether an email exists. Sent mail is provider acceptance, not proof of inbox
delivery; check your mailbox provider’s SPF/DKIM/DMARC and bounce logs.

The production proxy trust default is one hop for Railway; set TRUST_PROXY=0
for direct hosting, or adjust the topology before placing additional proxies in
front of Express.
