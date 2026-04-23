# Campaign Manager

Full-stack mini campaign manager. Marketers create email campaigns, schedule them, simulate sending, and view per-campaign stats.

## Stack

- **Backend** — Node 18+, Express, Sequelize over PostgreSQL, Zod, JWT in an httpOnly cookie, Jest + supertest.
- **Frontend** — React 18 + TypeScript, Vite, React Query, Redux Toolkit.
- **DB** — PostgreSQL via Docker.

Monorepo: `packages/backend` and `packages/frontend`, orchestrated with Yarn workspaces.

## Prerequisites

- Docker Desktop (only requirement for the one-command path)
- Node 18+ and Yarn — only if you want to run the stack on the host instead of in Docker

## Quick start (one command)

```bash
docker compose up
```

This brings up three services. The backend runs migrations and seeds the demo user on every start:

- `postgres` on host port **5434** (creates the `campaign_manager` database from `POSTGRES_DB`)
- `backend` on **http://localhost:4000** — runs `db:migrate` → `db:seed` → `dev`
- `frontend` on **http://localhost:5173** — Vite dev server, proxying `/api` to the backend service

Source is mounted as a bind volume on both app services, so edits hot-reload as usual. Ports 4000, 5173, and 5434 must be free on the host.

To tear down: `docker compose down` (append `-v` to also drop the Postgres volume and re-seed on the next `up`).

## Running on the host (alternative)

```bash
# 1. Install deps
yarn install

# 2. Start Postgres only (host port 5434)
docker compose up -d postgres

# 3. Create the test database (one-time; only needed if you plan to run the backend tests)
docker exec campaign-manager-postgres-1 psql -U postgres -c "CREATE DATABASE campaign_manager_test;"

# 4. Copy backend env file and fill in secrets
cp packages/backend/.env.example packages/backend/.env
# then edit packages/backend/.env — at minimum, set a real JWT_SECRET

# 5. Run migrations and seed
yarn db:migrate
yarn db:seed

# 6. Run both dev servers
yarn dev
```

Useful root scripts: `yarn test` (runs both workspaces), `yarn db:migrate`, `yarn db:rollback`, `yarn db:seed`.

Open `http://localhost:5173`.

## Default login

Created by `yarn db:seed`:

| Field    | Value              |
| -------- | ------------------ |
| Email    | `demo@example.com` |
| Password | `password123`      |
| Name     | `Demo User`        |

You can also register a new account from the `/register` page — registration does not require an invite.

## How I Used Claude Code

### Setup philosophy

I kept `.claude/` minimal: **3 skills** (`sequelize-patterns`, `api-response-shape`, `spec`), **1 agent** (`code-reviewer`), and **1 hook** (`auto-format.sh` — runs Prettier after every Write/Edit). The reasoning behind not adding more:

- **Skills only earn their place if they encode a non-obvious decision AND get reused ≥3 times.** For example, `sequelize-patterns` enforces "never use `sequelize.sync()`, migrations only; repositories are the only layer that imports Models; every multi-row write is in a transaction." Claude reaches for `sync()` for speed unless explicitly blocked. Zod and React Query don't need a skill — Claude writes them correctly by default.
- **Agents cost real tokens.** `code-reviewer` is reserved for module checkpoints (after auth, after campaigns, and in a pre-submission pass), not after every edit.
- **Hooks run unconditionally,** so I only installed one: auto-format. Lint/typecheck gates live in `yarn test` / `yarn typecheck` instead, which I run before committing.

**Spec-first workflow:** every feature has a `__spec/<name>.md` written before any code, generated via the `/spec` slash command. The spec forces me and Claude to align on the state machine, edge cases, and acceptance criteria up front. The `__spec/` folder ships with the code so a reviewer can see the intended behavior separately from the implementation.

### Tasks I delegated

| Task                                                  | Confidence                | Notes                                                                                |
| ----------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------ |
| Sequelize migrations + models                         | High                      | Repetitive, schema is well-defined up front                                          |
| Express controllers, services, repositories, Zod DTOs | High                      | Pure pattern application — the `api-response-shape` skill encodes the envelope rules |
| Jest + supertest integration tests                    | High                      | Supertest against the real DB catches most regressions                               |
| React Query hooks + page forms                        | Medium                    | Had to review prop-error merging and cache-invalidation carefully                    |
| Vitest flow tests (login, create, schedule)           | Medium                    | First pass was shallow — see "Where Claude was wrong"                                |
| Docker compose one-command setup                      | Medium                    | Required a back-and-forth on volume mounts and Vite proxy env                        |
| Schema design + indexing strategy                     | **Low — I did it myself** | See "What I would NOT let Claude do"                                                 |
| Business rule edge cases (spec content)               | **Low — I did it myself** |                                                                                      |
| This writeup                                          | **Low — I did it myself** |                                                                                      |

### Real prompts I used

**Prompt 1 — Generate a spec via `/spec`**

> `/spec campaign`

The `/spec` skill drafted `__spec/campaign.md` in one pass: the three-state lifecycle (`draft → scheduled → sent` with the allowed transitions and an explicit "no back-edges" rule), full acceptance criteria grouped by Create-and-list / Edit-and-delete / Schedule / Send / Stats / Ownership, edge cases (timezone-ambiguous `scheduled_at`, two-tab delete race, 100% simulated failure rate), and an "Open questions (resolved)" block that pinned my product decisions (100-recipient batch cap, synchronous send, no auto-dispatch at the scheduled moment). The skill then stopped for confirmation. I tweaked a handful of sentences and accepted the rest; that file became the source of truth every subsequent implementation prompt references.

**Prompt 2 — Implement a single API endpoint**

> Implement `POST /api/campaigns/:id/send` per `__spec/campaign.md` (Sending section). Constraints: synchronous — every recipient must be processed in the same request that flips the campaign to `sent`; accept `draft` or `scheduled` as the starting state; reject zero-recipient campaigns with a 422; two concurrent sends must not both succeed; per-recipient outcome is randomized using `SIMULATED_FAILURE_RATE` and `SIMULATED_OPEN_RATE` from the environment. Stay inside the `routes → controller → service → repository` layering; service throws `AppError`, controller shapes the `{ data }` envelope.

**Prompt 3 — Fix a client-side validation**

> On @packages/frontend/src/pages/RegisterPage.tsx, submitting an empty or invalid form still fires `POST /api/auth/register` — the client isn't validating first. @packages/frontend/src/pages/CampaignNewPage.tsx does a client-side Zod parse before calling `mutate()`; mirror that pattern here, with schema messages matching the backend DTO in @packages/backend/src/modules/auth/dto/register.dto.js. Add a Vitest flow test that asserts `fetch` is not called on an empty submit, and a second test that asserts it isn't called when the email is malformed or the password is under 8 characters.

### Where Claude Code was wrong

1. **Shallow component tests.** First frontend test pass was three rendering-only tests (`StatusBadge`, `ActionButtons`, `StatsPanel`) that asserted classes the JSX literally contains — zero defect-finding power. I deleted them and asked for flow tests. The replacements (create-campaign, login, schedule, register) run `userEvent` through the form, mock `fetch`, and assert on the exact POST body + post-navigation state.
2. **Register page skipped client-side validation.** See Prompt 3. Root cause: when Claude scaffolded the auth pages it modeled `RegisterPage` on `LoginPage` (which has no client validation because login failures are generic by design), not on `CampaignNewPage` (which has a Zod parse). Zero tests for the register flow hid the gap.
3. **README/stack drift after a mid-project pivot.** The Zustand → Redux Toolkit switch landed in code, but the stack line in `README.md` was untouched for two commits until the audit caught it.
4. **Stateless mock caused a ghost regression.** The first schedule-flow test failed in an unexpected way: the assertion "status flips to scheduled" never rendered, even though the POST succeeded. Root cause: `useScheduleCampaign` calls `invalidateLists(qc)`, which triggered a detail-query refetch, which hit my stateless `GET` mock and returned the stale draft — overwriting the `setQueryData` optimistic update. Fixed by making the GET handler return a shared `currentCampaign` that the POST handler mutates. Subtle, but a real cache-invalidation interaction worth testing.
5. **Proposed an unnecessary `postgres-init.sql`.** When designing the `docker compose up` flow I added an init script to auto-create the test database. You pushed back — seed data already runs on every backend container start, and the test DB is only needed for host-mode `yarn test`. Deleted the file and restored the one-line manual step to the host-mode README.

### What I would NOT let Claude Code do

1. **Schema design and indexing strategy.** I designed all indexes myself: campaigns_owner_created_at_idx, campaigns_owner_status_idx, campaign_recipients_campaign_status_idx, unique on recipients.email, and the composite PK on campaign_recipients. When Claude designs schemas autonomously... (`campaigns_owner_created_at_idx`, `campaigns_owner_status_idx`, `campaign_recipients_campaign_status_idx`, unique on `recipients.email`) and the composite PK on `campaign_recipients`. When Claude designs schemas autonomously it tends to miss composite indexes or add redundant columns. A wrong schema costs a corrective migration later.
2. **Business-rule decisions in specs.** Questions like "is the scheduled state auto-dispatched or does the user re-press send?" and "whole-list replacement vs. incremental edits?" are product decisions. I resolved them (see the "Open questions (resolved)" blocks at the bottom of each `__spec/*.md`); Claude implemented.
3. **Writing this section.** If Claude wrote about itself it would self-promote and lose honesty. I wrote this; Claude only typed it.
4. **Running destructive operations.** `git reset --hard`, `git push --force`, `DROP TABLE`, `rm -rf`, `kill <pid>` — none without explicit approval. At one point the Docker stack failed to come up because a leftover `node` dev-server was bound to :4000 on my host. Claude correctly identified the PID but refused to kill it, because that's my process on my machine. I killed it myself.
5. **Auto-commit / auto-push.** I review `git diff` before every commit. Claude only commits when I explicitly ask, and never pushes.

### Honest reflection

The most valuable thing Claude Code gave me wasn't speed — it was **enforced constraints**:

- Skills + `CLAUDE.md` forced me to _write down_ conventions instead of keeping them in my head. Onboarding a new contributor (or my future self) will be much easier as a result.
- The spec-first workflow forced me to _think through edge cases upfront_ instead of discovering them via bugs. The resolved-question blocks at the bottom of each spec capture decisions that would otherwise get lost.
- The habit of asking Claude to audit shipped code against the original assignment brief at checkpoints catches drift that neither code review nor tests can catch — specifically, "is the README still true?" and "does our shipped surface match what the assignment asked for?"

See [`CLAUDE.md`](./CLAUDE.md) for the full contributor guide and [`__spec/auth.md`](./__spec/auth.md) for the auth feature spec.
