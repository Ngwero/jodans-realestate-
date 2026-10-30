# Jodans Bloka

Uganda homes marketplace with a separate **backend portal** (admin + host consoles) and Express API.

## Run

```bash
cd pearl-stay
npm install
npm run dev
```

| Surface | URL |
|---------|-----|
| Marketplace | http://localhost:5173/ |
| **Backend hub** | http://localhost:5173/backend |
| Admin console | http://localhost:5173/admin/login |
| Host console | http://localhost:5173/host/login |
| API | http://127.0.0.1:4000/api/health |

### Demo logins

| Role  | Email                   | Password  |
|-------|-------------------------|-----------|
| Admin | admin@jodansbloka.com   | admin123  |
| Host  | host@jodansbloka.com    | host123   |

Hosts can also register from the host login page.

## Backend portal

- **`/backend`** — choose Admin or Host console
- **Admin** — dashboard stats, approve/reject/hide/delete listings, host directory
- **Host** — add/edit properties; new listings stay *pending* until approved
- **API** (`server/`) — JSON DB in `server/data/db.json`

Reset DB:

```bash
rm -f server/data/db.json
npm run dev:api
```
