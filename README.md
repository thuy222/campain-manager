# Campaign Manager

Full-stack mini campaign manager. Marketers create email campaigns, schedule them, simulate sending, and view per-campaign stats.

## Stack

- **Backend** — Node 18+, Express, Sequelize over PostgreSQL, Zod, JWT in an httpOnly cookie, Jest + supertest.
- **Frontend** — React 18 + TypeScript, Vite, React Query, Zustand.
- **DB** — PostgreSQL via Docker.

Monorepo: `packages/backend` and `packages/frontend`, orchestrated with Yarn workspaces.

## Prerequisites

- Node 18+
- Yarn
- Docker Desktop (for local Postgres)

## First-time setup

```bash
# 1. Install deps
yarn install

# 2. Start Postgres (host port 5434 — chosen to avoid conflicts with other local Postgres instances)
docker compose up -d postgres

# 3. Create the test database
docker exec campaign-manager-postgres-1 psql -U postgres -c "CREATE DATABASE campaign_manager_test;"

# 4. Copy backend env file and fill in secrets
cp packages/backend/.env.example packages/backend/.env
# then edit packages/backend/.env — at minimum, set a real JWT_SECRET

# 5. Run migrations against the dev DB
yarn workspace @campaign-manager/backend db:migrate

# 6. Seed the default demo user (idempotent — safe to re-run)
yarn workspace @campaign-manager/backend db:seed
```

## Running

```bash
yarn dev                 # backend (4000) + frontend (5173) together
yarn dev:backend         # backend only
yarn dev:frontend        # frontend only
```

Open `http://localhost:5173`.

## Default login

Created by `yarn workspace @campaign-manager/backend db:seed`:

| Field    | Value              |
| -------- | ------------------ |
| Email    | `demo@example.com` |
| Password | `password123`      |
| Name     | `Demo User`        |

You can also register a new account from the `/register` page — registration does not require an invite.

## Common commands

| Task                     | Command                                                |
| ------------------------ | ------------------------------------------------------ |
| Backend tests            | `yarn workspace @campaign-manager/backend test`        |
| Frontend typecheck       | `yarn workspace @campaign-manager/frontend typecheck`  |
| DB migrate / rollback    | `yarn workspace @campaign-manager/backend db:migrate` / `db:rollback` |
| DB seed / unseed         | `yarn workspace @campaign-manager/backend db:seed` / `db:seed:undo`   |
| psql into the dev DB     | `docker exec -it campaign-manager-postgres-1 psql -U postgres -d campaign_manager` |
| Format                   | `yarn prettier --write <path>`                         |

## Project conventions

- Routes → controller → service → repository. Only repositories import Sequelize models.
- Responses use a single envelope: `{ data: ... }` for success, `{ error: { code, message, details? } }` for errors.
- Sessions: 24-hour JWT in an httpOnly cookie, silently extended on every authenticated request.
- Specs live under `__spec/<feature>.md` and ship with the code.

See [`CLAUDE.md`](./CLAUDE.md) for the full contributor guide and [`__spec/auth.md`](./__spec/auth.md) for the auth feature spec.
