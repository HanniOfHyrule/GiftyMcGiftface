# 🎁 Gifty McGiftface

Welcome to **Gifty McGiftface** – your smart birthday & gift reminder app! 🎉

Keep track of birthdays, plan what to do for each person (buy a present, write a card, send a message)
and never miss one again.

## ✨ Features

- Birthday list, dashboard with upcoming birthdays and statistics, duplicate detection
- 📅 Personal iCal feed to subscribe to in Proton, Google or Apple Calendar
- ✅ Automatic tasks in [Todoist](https://todoist.com) before each birthday
- 🤝 Share your birthdays with other users
- 📥 CSV import (e.g. from a contacts export)
- 📊 Prometheus metrics

The UI is in German.

**Tech stack:** [NestJS](https://nestjs.com) + [TypeORM](https://typeorm.io) + PostgreSQL (backend),
React + [Vite](https://vite.dev) + Tailwind CSS (frontend), Docker Compose for deployment.

---

## 🚀 Getting Started

Clone the repo and create your `.env`:

```bash
git clone https://github.com/HanniOfHyrule/GiftyMcGiftface.git
cd GiftyMcGiftface
cp .env.example .env   # then set DATABASE_PASSWORD and JWT_SECRET (min. 32 characters)
```

**Run everything with Docker:**

```bash
docker compose up -d --build
```

The app is then available at http://localhost:3000. Register an account and you're ready to go.

**Local development** — install dependencies with [pnpm](https://pnpm.io) in both `backend/` and `frontend/`:

```bash
cd backend && pnpm install
cd ../frontend && pnpm install
```

Start the database (`docker compose up -d postgres`), then:

- Backend: `cd backend && pnpm start:dev` → http://localhost:3001
- Frontend: `cd frontend && pnpm dev` → http://localhost:3000 (Vite; `/api` is proxied to the backend)

Run the tests with `pnpm test` in `backend/`.

## 📥 Import birthdays from CSV

The script [backend/csv.import.script.ts](backend/csv.import.script.ts) imports birthdays from a CSV file
into the Postgres database and assigns them to an **existing user** (register in the app first).

**CSV format** (e.g. a contacts export, extra columns are ignored):

```csv
First Name,Last Name,Birthday
"Anna","Muster","1990-05-12"
"Ben","Beispiel","--11-15"
```

`Birthday` must be `YYYY-MM-DD` or `--MM-DD` (without year). Rows without a name or with an invalid date are skipped,
as are people the user already has (same first and last name) — so the script can safely be run multiple times.

**Run it** (Postgres must be running, e.g. via `docker compose up -d`):

```bash
cd backend
pnpm install
pnpm import-csv <your-email> [path/to/file.csv]
```

Without a path, `src/data/contacts_min.csv` is used. The database credentials are read from the `.env` in the
project root; by default the script connects to `localhost:5433` (the Postgres port of the Docker setup).
Override with `DATABASE_HOST` / `DATABASE_PORT` if your database runs elsewhere.

Example:

```bash
pnpm import-csv hanni@example.com src/data/contacts.csv
```

Imported entries get the todo `NEEDPRESENT` and show up in the app and the calendar subscription right away.

## 🔌 Useful Endpoints

All endpoints require a JWT (`Authorization: Bearer <token>`, obtained via login). Through the frontend they are
reachable under `/api` (e.g. `http://localhost:3000/api/birthdays`), the backend itself serves them without
the prefix on port `3001`.

| Endpoint | Description |
|---|---|
| `GET /birthdays` | All birthdays |
| `GET /birthdays/upcoming?days=30` | Upcoming birthdays |
| `GET /birthdays/statistics` | Statistics |
| `GET /birthdays/duplicates` | Possible duplicates |
| `GET /birthdays/calendar/ics` | Download all birthdays as iCal |

## 📅 Calendar subscription (Proton, Google, Apple, ...)

In the app, open **Verwalten** → **Proton Kalender** and copy your personal link
(`https://<your-host>/api/birthdays/calendar/feed/<token>.ics`). Add it in Proton
Calendar via **+** → **Kalender über URL hinzufügen** — changes in the app sync automatically
(Proton refreshes subscribed calendars periodically, typically every few hours).

Requirements:

- The app must be reachable **publicly via HTTPS** — Proton fetches the link from its own servers,
  so `localhost` won't work. Only the path `/api/birthdays/calendar/feed/*` needs to be public.
- Open the app via that public address when copying the link; it is built from the address in your browser.
- The link contains a secret token and needs no login — don't share it. If it leaks, use
  **Neuen Link erzeugen** (the old link stops working; re-add the new one in Proton).

## 🤝 Sharing birthdays

In **Verwalten** → **Geburtstage teilen**, enter the email of another registered user to share
all your birthdays with them. They see the request in the same card (and as a banner on the
dashboard) and can accept or decline it.

- Sharing is **one-way**: if A shares with B, B sees A's birthdays, not the other way around.
  B can send a separate share to A.
- Once accepted, the recipient sees the shared birthdays in their list, overview and statistics,
  in their calendar subscription, and in their Todoist sync. Each of these entries is
  marked "geteilt von …".
- The recipient can **edit** shared birthdays. The edits change the owner's entry, so both users see
  them. Only the owner can **delete** an entry (the API returns `403` for the recipient).
- The owner can withdraw or end a share at any time, and the recipient can end it too. The birthdays
  then disappear from the recipient's list and calendar feed. Todoist tasks that were already
  created stay in Todoist.

API: `GET /shares`, `POST /shares` (`{ "email": "…" }`), `POST /shares/:id/accept`, `DELETE /shares/:id`.

## 🏭 Production

1. Copy `.env.example` to `.env` and fill it in. `JWT_SECRET` must be at least 32 characters, otherwise the backend refuses to start.
2. Registration is open to everyone with a valid email address (rate-limited to 5 attempts per minute per IP).
3. Start with `docker compose up -d --build`. Only the frontend (port `3000`, configurable via `FRONTEND_PORT`) is exposed;
   Postgres (`5433`) and the backend (`3001`) are bound to `127.0.0.1` only. Put an HTTPS reverse proxy / tunnel in front of port 3000
   and set `TRUST_PROXY=2` so rate limiting sees the real client IP.
4. **Heads-up:** variables set in your shell environment override `.env` in Docker Compose. If the backend complains about
   `JWT_SECRET`, check `echo $JWT_SECRET` in your terminal.

To connect to Postgres via TLS, set `DATABASE_SSL_CA` to the path of the database's CA certificate.

### Database migrations

The schema is managed by TypeORM migrations (no more `synchronize`). They run automatically on backend start.
After changing an entity, generate a new migration and register it in `backend/src/data-source.ts`:

```bash
cd backend
pnpm migration:generate src/migrations/DescribeYourChange
```

### Backups

The `backup` service writes a daily `pg_dump` to `./backups` and keeps the last 14 days (`BACKUP_KEEP_DAYS`).
Restore:

```bash
gunzip -c backups/<file>.sql.gz | docker compose exec -T postgres psql -U <DATABASE_USERNAME> -d <DATABASE_NAME>
```

Store copies of `./backups` off the server as well.

### Rate limits

120 requests/minute per IP overall; login 10/min, registration 5/min, token refresh 20/min.

### Metrics (Prometheus)

The backend serves Prometheus metrics on a **separate port** (`METRICS_PORT`, default `9100`) at `/metrics`, not on
the app port. That's deliberate: the frontend's nginx forwards every `/api/*` request to port 3001, so a route there
would be public. Make port 9100 reachable only for your Prometheus. Locally: `curl localhost:9100/metrics` inside
the backend container.

- **Event counters** live in [backend/src/metrics/metrics.ts](backend/src/metrics/metrics.ts). The service or controller
  that owns an event increments its counter. Name them `gifty_<noun>_<verb>_total` and give each one a doc comment
  saying what it counts and what its label values mean.
- **Totals** (users, birthdays, Todoist connections, …) are counted from the database on every scrape
  ([db-collector.ts](backend/src/metrics/db-collector.ts)). They export only aggregate counts, never names, dates
  or emails.
- **HTTP metrics** are labelled by route pattern (`/birthdays/:id`), not by raw path.

## ✅ Todoist integration

Gifty McGiftface can create tasks in [Todoist](https://todoist.com) automatically. Every day at 06:00 (Europe/Berlin)
it creates a task in the Todoist project **"Gifty McGiftface"** for every birthday in the next 30 days, based on the todo:

| Todo | Task | Due (default) |
|---|---|---|
| NEEDPRESENT | 🎁 Geschenk für … besorgen | 7 days before |
| NEEDCARD | ✉️ Geburtstagskarte für … schreiben | 5 days before |
| WHATSAPP | 💬 … zum Geburtstag gratulieren | on the birthday |

Each birthday gets one task per year. Tasks you delete in Todoist are not re-created; if you delete the project,
it is re-created on the next sync. Lead times can be changed per user in the app.

**Setup (once per server):**

1. Create an app in the [Todoist App Management Console](https://developer.todoist.com/appconsole.html).
2. Set its **OAuth redirect URL** to `<APP_URL>/api/todoist/callback`, e.g.
   `https://gifty.example.com/api/todoist/callback` (for local testing `http://localhost:3000/api/todoist/callback`).
3. Put the credentials into `.env` and restart:

   ```env
   APP_URL=https://gifty.example.com
   TODOIST_CLIENT_ID=...
   TODOIST_CLIENT_SECRET=...
   ```

4. In the app: **Verwalten → Todoist → Mit Todoist verbinden**.

Todoist tokens are stored encrypted (AES-256-GCM). The key is derived from `TODOIST_ENCRYPTION_KEY`, or from
`JWT_SECRET` if not set — changing it means users have to reconnect Todoist.

## 📄 License

[MIT](LICENSE)
