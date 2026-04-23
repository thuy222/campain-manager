---
name: sequelize-patterns
description: Use when writing or reviewing any Sequelize code — model definitions, associations, repositories, transactions, migrations, or SQL aggregation. Covers the Campaign Manager data layer conventions (repository pattern, migrations-only, required indexes, single-query stats).
---

# Sequelize Patterns — Campaign Manager

This skill is authoritative for **all** Sequelize-touching code in `packages/backend`. If something here conflicts with a snippet you're about to write, change the snippet.

## 1. Model definition — `Model.init` pattern

One file per model under `packages/backend/src/db/models/<name>.ts`. **Always use `Model.init`**, never `sequelize.define`, never decorators.

```ts
// src/db/models/campaign.ts
import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type ForeignKey,
} from "sequelize";
import { sequelize } from "../sequelize";
import type { User } from "./user";

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent";

export class Campaign extends Model<InferAttributes<Campaign>, InferCreationAttributes<Campaign>> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare subject: string;
  declare body: string;
  declare status: CampaignStatus;
  declare scheduled_at: Date | null;
  declare created_by: ForeignKey<User["id"]>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

Campaign.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(200), allowNull: false },
    subject: { type: DataTypes.STRING(200), allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    status: {
      type: DataTypes.ENUM("draft", "scheduled", "sending", "sent"),
      allowNull: false,
      defaultValue: "draft",
    },
    scheduled_at: { type: DataTypes.DATE, allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: false },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "campaigns",
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);
```

Rules:

- `underscored: true` on every model — columns are `snake_case`, TS fields match the column name 1:1.
- Typed with `InferAttributes` / `InferCreationAttributes`. No `any`.
- `tableName` explicit (plural, snake_case). Do not rely on pluralization.
- No `defaultScope` that silently filters rows — it will bite you in tests.

## 2. Associations — one place: `db/associations.ts`

Do **not** put `hasMany` / `belongsTo` calls inside model files. It tangles import order and duplicates definitions. Centralize:

```ts
// src/db/associations.ts
import { User } from "./models/user";
import { Campaign } from "./models/campaign";
import { Recipient } from "./models/recipient";
import { CampaignRecipient } from "./models/campaign-recipient";

export function registerAssociations() {
  User.hasMany(Campaign, { foreignKey: "created_by", as: "campaigns" });
  Campaign.belongsTo(User, { foreignKey: "created_by", as: "creator" });

  Campaign.hasMany(CampaignRecipient, {
    foreignKey: "campaign_id",
    as: "deliveries",
  });
  CampaignRecipient.belongsTo(Campaign, { foreignKey: "campaign_id" });

  Recipient.hasMany(CampaignRecipient, { foreignKey: "recipient_id" });
  CampaignRecipient.belongsTo(Recipient, {
    foreignKey: "recipient_id",
    as: "recipient",
  });
}
```

Call `registerAssociations()` once during app bootstrap, after all models are imported.

## 3. Repository pattern — the only layer that touches Models

**Rule: `import { Campaign } from '../db/models/campaign'` is allowed in `src/repositories/*.ts` and migration/seed files only.** Not in controllers. Not in services. Not in middleware. Not in tests of services.

```ts
// src/repositories/campaign-repository.ts
import { Op, type Transaction } from "sequelize";
import { Campaign, type CampaignStatus } from "../db/models/campaign";

export type CampaignRow = {
  id: string;
  name: string;
  subject: string;
  body: string;
  status: CampaignStatus;
  scheduled_at: Date | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
};

export const campaignRepository = {
  async findByIdForOwner(
    id: string,
    ownerId: string,
    tx?: Transaction,
  ): Promise<CampaignRow | null> {
    const row = await Campaign.findOne({
      where: { id, created_by: ownerId },
      transaction: tx,
    });
    return row ? (row.get({ plain: true }) as CampaignRow) : null;
  },

  async listByOwner(
    ownerId: string,
    { limit, offset }: { limit: number; offset: number },
  ): Promise<{ rows: CampaignRow[]; count: number }> {
    const { rows, count } = await Campaign.findAndCountAll({
      where: { created_by: ownerId },
      order: [["created_at", "DESC"]],
      limit,
      offset,
    });
    return {
      rows: rows.map((r) => r.get({ plain: true }) as CampaignRow),
      count,
    };
  },

  async updateDraft(
    id: string,
    ownerId: string,
    patch: Partial<Pick<CampaignRow, "name" | "subject" | "body">>,
    tx?: Transaction,
  ): Promise<number> {
    const [affected] = await Campaign.update(patch, {
      where: { id, created_by: ownerId, status: "draft" },
      transaction: tx,
    });
    return affected;
  },

  async transitionStatus(
    id: string,
    from: CampaignStatus[],
    to: CampaignStatus,
    tx?: Transaction,
  ): Promise<number> {
    const [affected] = await Campaign.update(
      { status: to },
      { where: { id, status: { [Op.in]: from } }, transaction: tx },
    );
    return affected; // 0 means precondition failed — caller throws STATE_CONFLICT
  },
};
```

Always return **plain objects** (`.get({ plain: true })`). Never return Model instances — they leak Sequelize to upper layers and break JSON serialization subtly (timestamps, virtuals, etc).

## 4. Transactions — required for multi-row writes

If a single request modifies more than one row (send, schedule-with-recipients, delete-with-cascade), wrap in a transaction:

```ts
await sequelize.transaction(async (tx) => {
  const affected = await campaignRepository.transitionStatus(
    id,
    ["draft", "scheduled"],
    "sending",
    tx,
  );
  if (affected === 0) throw new AppError("STATE_CONFLICT", "Cannot send in current state", 409);
  await campaignRecipientRepository.bulkMarkPending(id, tx);
});
```

- Pass `tx` through every repository call inside the block.
- Throw `AppError` to roll back — never return a success response from inside the block and assume commit.
- Use `SERIALIZABLE` isolation only if you're preventing a race you've actually diagnosed. Default isolation is fine for this app.

## 5. Migrations only — never `sequelize.sync`

- `sequelize.sync()`, `sync({ force: true })`, `sync({ alter: true })` are **banned** in all code paths, including test setup. Tests use migrations too.
- Schema lives in `packages/backend/migrations/YYYYMMDDHHMMSS-description.js`. Run `yarn db:migrate` from the repo root.
- One migration per logical change. Don't edit a shipped migration — write a new one.
- Every migration has `up` **and** `down`.

## 6. Required indexes (ship these in the first migration)

| Table                 | Columns                                               | Reason                                     |
| --------------------- | ----------------------------------------------------- | ------------------------------------------ |
| `users`               | `email` UNIQUE                                        | login lookup + idempotent register         |
| `campaigns`           | `created_by`                                          | list campaigns by owner (the common query) |
| `campaigns`           | `(created_by, status)`                                | filtered lists by owner + status           |
| `campaigns`           | `scheduled_at` WHERE `status = 'scheduled'` (partial) | due-work scan                              |
| `recipients`          | `email` UNIQUE                                        | dedupe on upsert                           |
| `campaign_recipients` | `(campaign_id, status)`                               | stats aggregation + per-campaign listing   |
| `campaign_recipients` | `(campaign_id, recipient_id)` UNIQUE                  | one delivery row per pair                  |

Be ready to justify each index in terms of a query the app actually runs.

## 7. Stats aggregation — one query, not a loop

`GET /campaigns/:id/stats` must compute counts in a **single SQL statement** using `COUNT(*) FILTER (WHERE …)`:

```ts
const [row] = await sequelize.query<{
  total: string;
  sent: string;
  failed: string;
  opened: string;
}>(
  `
    SELECT
      COUNT(*)::int                                              AS total,
      COUNT(*) FILTER (WHERE status = 'sent')::int               AS sent,
      COUNT(*) FILTER (WHERE status = 'failed')::int             AS failed,
      COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::int         AS opened
    FROM campaign_recipients
    WHERE campaign_id = :campaignId
  `,
  { replacements: { campaignId }, type: QueryTypes.SELECT },
);
```

Then compute rates in JS:

```ts
const total = row.total;
const sent = row.sent;
const open_rate = sent === 0 ? 0 : round4(row.opened / sent);
const send_rate = total === 0 ? 0 : round4(sent / total);
return {
  total,
  sent,
  failed: row.failed,
  opened: row.opened,
  open_rate,
  send_rate,
};
```

Anti-pattern (do **not** do):

```ts
// ❌ one query per bucket — N extra round trips for nothing
const sent = await CampaignRecipient.count({
  where: { campaign_id, status: "sent" },
});
const failed = await CampaignRecipient.count({
  where: { campaign_id, status: "failed" },
});
// ...
```

## 8. Query hygiene

- **Never `findAll` without `limit`.** If you need "all", paginate. For stats-like whole-table scans, aggregate in SQL.
- **Always parameterize.** Use `replacements` for raw queries. Never template-literal-interpolate user input into SQL.
- **Explicit `order`** on any list. Unordered list pagination is a bug.
- **No `include` chains deeper than 1 level** in a single query — fetch, then fetch again. N+1 hides in deep includes.
- Prefer `update(where: { ..., status: 'draft' })` over load-then-save — lets Postgres enforce the precondition and returns affected-row count for state-machine guards.
