# Campaign Manager — Claude Code Context

Full-stack Mini Campaign Manager. Marketers create email campaigns, schedule them, simulate sending, and view per-campaign stats.

## Read first

1. **[`.claude/common-rules.md`](./.claude/common-rules.md)** — project-agnostic behavioral + coding rules (think before coding, simplicity, surgical changes, goal-driven execution, naming, types, anti-patterns). Assume these apply unless overridden below.
2. **[`__spec/<feature>.md`](./__spec/)** — the spec for whatever you're building. No spec → run `/spec <feature>` and stop for confirmation.
3. **Auto-invoke skills** do the detail work:
   - `sequelize-patterns` — model/repo/migration/transaction/index/aggregation rules.
   - `api-response-shape` — envelopes, HTTP status matrix, error codes, `AppError`, `asyncHandler`, never-leak rules.

Source-of-truth order: this file > `__spec/<feature>.md` > code. If the spec disagrees with this file, update the spec.

## Stack

Monorepo — Yarn workspaces, two packages.

- `packages/backend` — Node 18+, Express, Sequelize over PostgreSQL, Zod validation, JWT in an httpOnly cookie, Jest + supertest.
- `packages/frontend` — React 18 + TypeScript, Vite, React Query (server state), Zustand (client state), Vitest.

Postgres runs locally via Docker.

## Commands

Run from repo root.

| Task | Command |
| --- | --- |
| Install | `yarn install` |
| Dev (both) | `yarn dev` |
| Dev backend only | `yarn dev:backend` |
| Dev frontend only | `yarn dev:frontend` |
| Backend tests | `yarn workspace @campaign-manager/backend test` |
| Frontend tests | `yarn workspace @campaign-manager/frontend test` |
| One backend test | `yarn workspace @campaign-manager/backend test -- <pattern>` |
| Format (auto via hook) | `yarn prettier --write <path>` |
| DB up | `docker compose up -d postgres` |
| DB migrate / rollback | `yarn workspace @campaign-manager/backend db:migrate` / `db:rollback` |
| psql | `psql postgresql://postgres:postgres@localhost:5432/campaign_manager` |

## Domain rules (enforce server-side, always)

1. **Editable only when `status = 'draft'`.** `PATCH` / `DELETE /campaigns/:id` on any other state → **409 `STATE_CONFLICT`**.
2. **`scheduled_at` must be strictly in the future** at request time. Past/now → **422 `VALIDATION_ERROR`**.
3. **Sending is one-way and async.** `POST /campaigns/:id/send` transitions `draft|scheduled → sending` synchronously, enqueues dispatch, returns **202 Accepted** with the updated campaign. The worker completes `sending → sent`. `sent → *` is impossible.
4. **State machine:** `draft → scheduled → sending → sent`, plus `draft → sending → sent` (direct send). Nothing else.
5. **Ownership:** users only read/mutate campaigns where `created_by = req.user.id`. Anything else → **404 `NOT_FOUND`** (never leak existence via 403).
6. **Stats shape — exact keys, always all 6:**
   ```json
   { "total": 0, "sent": 0, "failed": 0, "opened": 0, "open_rate": 0, "send_rate": 0 }
   ```
   Rates are decimals in `[0, 1]` rounded to 4 places. `open_rate = opened / sent` (0 when `sent = 0`). `send_rate = sent / total` (0 when `total = 0`).

## Project layering

`controller → service → repository`

- **Controller** — parses `req`, calls service, shapes response. No business logic. **No Sequelize Model imports.**
- **Service** — business rules, state transitions, orchestration, transactions. Throws `AppError`. No `req` / `res`.
- **Repository** — the *only* layer that touches Sequelize Models. Returns plain objects, not Model instances. See `sequelize-patterns` skill.

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

## Workflow

1. Read the relevant `__spec/<feature>.md` (or generate one with `/spec <feature>` and wait for confirmation).
2. Log the prompt to `__prompts/session-log.md` — this feeds the README "How I Used Claude Code" section.
3. Implement following `common-rules.md` + the two auto-invoke skills.
4. **Module checkpoints, not per-edit reviews.** When a module (e.g., campaign CRUD) is wired end-to-end with tests, run the `code-reviewer` agent.
5. **Spec files are part of the deliverable.** `__spec/<feature>.md` is tracked in git and pushed to GitHub — commit the spec in the same PR as the feature it describes (or in a preceding spec-only PR). Never gitignore `__spec/`. If the spec changed during implementation, update it before merging — the merged spec is the source of truth for reviewers.

## Suggested implementation order

`auth → campaign → recipients`

## Out of scope

No real SMTP. No cron/worker infra beyond an in-process queue. No multi-tenant org model. No email templating language. No metrics/tracing beyond request logging.
