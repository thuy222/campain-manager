# Campaign Manager — Claude Code Context

Full-stack Mini Campaign Manager. Marketers create email campaigns, schedule them, simulate sending, and view per-campaign stats.

## Read first

1. **[`.claude/common-rules.md`](./.claude/common-rules.md)** — project-agnostic behavioral + coding rules (think before coding, simplicity, surgical changes, goal-driven execution, naming, types, anti-patterns). Assume these apply unless overridden below.
2. **[`__spec/<feature>.md`](./__spec/)** — the spec for whatever you're building. No spec → run `/spec <feature>` and stop for confirmation.
3. **Auto-invoke skills** do the detail work:
   - `sequelize-patterns` — model/repo/migration/transaction/index/aggregation rules.
   - `api-response-shape` — envelopes, HTTP status matrix, error codes, `AppError`, `asyncHandler`, never-leak rules.

## Stack

Monorepo — Yarn workspaces, two packages.

- `packages/backend` — Node 18+, Express, Sequelize over PostgreSQL, Zod validation, JWT in an httpOnly cookie, Jest + supertest.
- `packages/frontend` — React 18 + TypeScript, Vite, React Query (server state), Redux Toolkit + react-redux (client state), Vitest.

Postgres runs locally via Docker.

## Commands

Run from repo root.

| Task                        | Command                                                               |
| --------------------------- | --------------------------------------------------------------------- |
| Install                     | `yarn install`                                                        |
| Dev (both)                  | `yarn dev`                                                            |
| Dev backend only            | `yarn dev:backend`                                                    |
| Dev frontend only           | `yarn dev:frontend`                                                   |
| All tests (both workspaces) | `yarn test`                                                           |
| Backend tests               | `yarn workspace @campaign-manager/backend test`                       |
| Frontend tests              | `yarn workspace @campaign-manager/frontend test`                      |
| One backend test            | `yarn workspace @campaign-manager/backend test -- <pattern>`          |
| Format (auto via hook)      | `yarn prettier --write <path>`                                        |
| DB up                       | `docker compose up -d postgres`                                       |
| DB migrate / rollback       | `yarn db:migrate` / `yarn db:rollback`                                |
| DB seed                     | `yarn db:seed`                                                        |
| psql                        | `psql postgresql://postgres:postgres@localhost:5434/campaign_manager` |

## Project layering

`controller → service → repository`

- **Controller** — parses `req`, calls service, shapes response. No business logic. **No Sequelize Model imports.**
- **Service** — business rules, state transitions, orchestration, transactions. Throws `AppError`. No `req` / `res`.
- **Repository** — the _only_ layer that touches Sequelize Models. Returns plain objects, not Model instances. See `sequelize-patterns` skill.

DTOs are Zod schemas; use `z.infer` for the type. One schema per body/query/params.

## Module structure

Backend code is organized by feature under `src/modules/<name>/`. One folder per domain module (`campaigns`, later `auth`, `recipients`, …). Shared bootstrap stays at `src/app.js` (express app + middleware + module mounts) and `src/index.js` (listen only).

Each module contains these files, named `<name>.<role>.js`:

```
src/modules/<name>/
├── <name>.routes.js       # express.Router(); instantiates service + controller and wires handlers
├── <name>.controller.js   # class; methods shape req/res; depends on the service
├── <name>.service.js      # class; business logic; throws AppError
├── <name>.repository.js   # class; the only place that imports Sequelize Models (add when DB lands)
├── dto/                   # Zod schemas (add when validation lands)
└── models/                # Sequelize models (add when DB lands)
```

**Controllers and services are classes**, not bags of functions:

- Service holds its dependencies (repository, other services) on `this`; controller holds its service on `this`.
- Define controller request handlers as **arrow-function class fields** (`list = (req, res) => {...}`) so they retain `this` when passed to `router.get(...)`. Don't pass `controller.list.bind(controller)` — that's the workaround we're avoiding.
- The routes file is the composition root: `new Service()` → `new Controller(service)` → mount on an `express.Router()`. No DI framework.
- One instance per process (module-scope `new`). If a module needs shared state across routes files, export the instance from the module, not the class.

Route file is the only place that knows wiring; `app.js` only sees the router.

## Project anti-patterns (on top of `common-rules.md`)

- ❌ `sequelize.sync()` — anywhere, including tests. Migrations only.
- ❌ Prisma, TypeORM, or any second ORM alongside Sequelize.
- ❌ `Model.findAll()` without `limit` / pagination.
- ❌ Importing Sequelize Models outside `src/repositories/*` and migrations.
- ❌ Multi-row writes without a transaction.
- ❌ Returning a partial stats shape — always all 6 keys.
- ❌ JWT in `localStorage`. httpOnly cookie only.
- ❌ Top-level response shapes other than `{ data, meta? }` or `{ error: { code, message, details? } }`.
