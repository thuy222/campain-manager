const AppError = require("../../lib/AppError");
const { ErrorCode } = require("../../lib/errorCodes");
const { sequelize } = require("../../db/models");

const clamp01 = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
};

const SIMULATED_FAILURE_RATE = clamp01(process.env.SIMULATED_FAILURE_RATE);
const SIMULATED_OPEN_RATE = clamp01(process.env.SIMULATED_OPEN_RATE);

const notFound = () => new AppError(ErrorCode.NOT_FOUND, "Not found", 404);
const stateConflict = (message) => new AppError(ErrorCode.STATE_CONFLICT, message, 409);
const validation = (message, details) =>
  new AppError(ErrorCode.VALIDATION_ERROR, message, 422, details);

const round4 = (n) => Math.round(n * 10000) / 10000;

class CampaignsService {
  constructor(repository) {
    this.repository = repository;
    this.failureRate = SIMULATED_FAILURE_RATE;
    this.openRate = SIMULATED_OPEN_RATE;
  }

  toPublic(row, extras = {}) {
    return {
      id: row.id,
      name: row.name,
      subject: row.subject,
      body: row.body,
      status: row.status,
      scheduled_at: row.scheduled_at,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      ...extras,
    };
  }

  async create(ownerId, { name, subject, body, recipients }) {
    return sequelize.transaction(async (tx) => {
      const row = await this.repository.create({ name, subject, body, createdBy: ownerId }, tx);
      await this.repository.replaceRecipients(row.id, recipients, tx);
      return this.toPublic(row, { recipient_count: recipients.length });
    });
  }

  async list(ownerId, { page, limit, status }) {
    const offset = (page - 1) * limit;
    const { rows, count } = await this.repository.findByOwner({
      createdBy: ownerId,
      status,
      limit,
      offset,
    });
    const data = rows.map((r) => this.toPublic(r, { recipient_count: r.recipient_count }));
    return { data, meta: { page, limit, total: count } };
  }

  async get(ownerId, id) {
    const row = await this.repository.findById(id, ownerId);
    if (!row) throw notFound();
    const recipient_count = await this.repository.countRecipients(row.id);
    return this.toPublic(row, { recipient_count });
  }

  async updateDraft(ownerId, id, patch) {
    return sequelize.transaction(async (tx) => {
      const { recipients, ...fields } = patch;
      let affected = 0;
      if (Object.keys(fields).length > 0) {
        affected = await this.repository.updateDraft(id, ownerId, fields, tx);
      }
      // If no writable fields other than recipients, we still must confirm the
      // campaign exists + is a draft before touching the join table.
      const current = await this.repository.findById(id, ownerId, tx);
      if (!current) throw notFound();
      if (current.status !== "draft") {
        throw stateConflict("this campaign is no longer editable");
      }
      // A patch with fields present but 0 rows affected means the row
      // transitioned after findById — tiny window, still surface as conflict.
      if (Object.keys(fields).length > 0 && affected === 0) {
        throw stateConflict("this campaign is no longer editable");
      }
      if (recipients !== undefined) {
        await this.repository.replaceRecipients(id, recipients, tx);
      }
      const refreshed = await this.repository.findById(id, ownerId, tx);
      const recipient_count = await this.repository.countRecipients(id, tx);
      return this.toPublic(refreshed, { recipient_count });
    });
  }

  async deleteDraft(ownerId, id) {
    return sequelize.transaction(async (tx) => {
      const affected = await this.repository.deleteDraft(id, ownerId, tx);
      if (affected > 0) return;
      const current = await this.repository.findById(id, ownerId, tx);
      if (!current) throw notFound();
      throw stateConflict("this campaign is no longer editable");
    });
  }

  async schedule(ownerId, id, scheduledAt) {
    return sequelize.transaction(async (tx) => {
      const current = await this.repository.findById(id, ownerId, tx);
      if (!current) throw notFound();
      if (current.status !== "draft") {
        throw stateConflict("only draft campaigns can be scheduled");
      }
      const recipientCount = await this.repository.countRecipients(id, tx);
      if (recipientCount === 0) {
        throw validation("at least one recipient required", {
          recipients: "at least one recipient required",
        });
      }
      if (!(scheduledAt instanceof Date) || Number.isNaN(scheduledAt.getTime())) {
        throw validation("scheduled_at is not a valid date", {
          scheduled_at: "scheduled_at is not a valid date",
        });
      }
      if (scheduledAt.getTime() <= Date.now()) {
        throw validation("scheduled_at must be strictly in the future", {
          scheduled_at: "scheduled_at must be strictly in the future",
        });
      }
      const updated = await this.repository.transitionStatus(
        {
          id,
          createdBy: ownerId,
          fromStatuses: ["draft"],
          toStatus: "scheduled",
          extra: { scheduled_at: scheduledAt },
        },
        tx,
      );
      if (!updated) {
        throw stateConflict("only draft campaigns can be scheduled");
      }
      return this.toPublic(updated, { recipient_count: recipientCount });
    });
  }

  async send(ownerId, id) {
    return sequelize.transaction(async (tx) => {
      const current = await this.repository.findById(id, ownerId, tx);
      if (!current) throw notFound();
      if (current.status === "sent") {
        throw stateConflict("this campaign has already been sent");
      }
      if (current.status !== "draft" && current.status !== "scheduled") {
        throw stateConflict("this campaign cannot be sent in its current state");
      }
      const recipientCount = await this.repository.countRecipients(id, tx);
      if (recipientCount === 0) {
        throw validation("at least one recipient required", {
          recipients: "at least one recipient required",
        });
      }
      const updated = await this.repository.transitionStatus(
        {
          id,
          createdBy: ownerId,
          fromStatuses: ["draft", "scheduled"],
          toStatus: "sent",
        },
        tx,
      );
      if (!updated) {
        throw stateConflict("this campaign has already been sent");
      }
      await this.repository.markAllPendingAsSent(
        id,
        {
          failureRate: this.failureRate,
          openRate: this.openRate,
          now: new Date(),
        },
        tx,
      );
      return this.toPublic(updated, { recipient_count: recipientCount });
    });
  }

  async stats(ownerId, id) {
    const row = await this.repository.getStats(id, ownerId);
    if (!row) throw notFound();
    const total = row.total || 0;
    const sent = row.sent || 0;
    const failed = row.failed || 0;
    const opened = row.opened || 0;
    const send_rate = total > 0 ? round4(sent / total) : 0;
    const open_rate = sent > 0 ? round4(opened / sent) : 0;
    return { total, sent, failed, opened, open_rate, send_rate };
  }
}

module.exports = CampaignsService;
