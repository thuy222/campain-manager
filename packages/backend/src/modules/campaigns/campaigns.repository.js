const { QueryTypes, Op } = require("sequelize");
const { sequelize, Campaign, Recipient, CampaignRecipient } = require("../../db/models");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);

class CampaignsRepository {
  async create({ name, subject, body, createdBy }, tx) {
    const row = await Campaign.create(
      { name, subject, body, created_by: createdBy },
      { transaction: tx },
    );
    return row.get({ plain: true });
  }

  async findById(id, createdBy, tx) {
    if (!isUuid(id) || !isUuid(createdBy)) return null;
    const row = await Campaign.findOne({
      where: { id, created_by: createdBy },
      transaction: tx,
    });
    return row ? row.get({ plain: true }) : null;
  }

  async findByOwner({ createdBy, status, limit, offset }, tx) {
    const where = { created_by: createdBy };
    if (status) where.status = status;
    const { rows, count } = await Campaign.findAndCountAll({
      where,
      order: [["created_at", "DESC"]],
      limit,
      offset,
      transaction: tx,
    });
    const items = rows.map((r) => r.get({ plain: true }));
    const ids = items.map((r) => r.id);
    const countsById = new Map();
    if (ids.length > 0) {
      const counts = await sequelize.query(
        `SELECT campaign_id, COUNT(*)::int AS count
           FROM campaign_recipients
          WHERE campaign_id IN (:ids)
          GROUP BY campaign_id`,
        {
          replacements: { ids },
          type: QueryTypes.SELECT,
          transaction: tx,
        },
      );
      for (const c of counts) countsById.set(c.campaign_id, c.count);
    }
    for (const item of items) {
      item.recipient_count = countsById.get(item.id) || 0;
    }
    return { rows: items, count };
  }

  async updateDraft(id, createdBy, patch, tx) {
    if (!isUuid(id) || !isUuid(createdBy)) return 0;
    const [affected] = await Campaign.update(patch, {
      where: { id, created_by: createdBy, status: "draft" },
      transaction: tx,
    });
    return affected;
  }

  async deleteDraft(id, createdBy, tx) {
    if (!isUuid(id) || !isUuid(createdBy)) return 0;
    return Campaign.destroy({
      where: { id, created_by: createdBy, status: "draft" },
      transaction: tx,
    });
  }

  async transitionStatus({ id, createdBy, fromStatuses, toStatus, extra = {} }, tx) {
    if (!isUuid(id) || !isUuid(createdBy)) return null;
    const [affected] = await Campaign.update(
      { status: toStatus, ...extra },
      {
        where: {
          id,
          created_by: createdBy,
          status: { [Op.in]: fromStatuses },
        },
        transaction: tx,
      },
    );
    if (affected === 0) return null;
    const row = await Campaign.findOne({
      where: { id, created_by: createdBy },
      transaction: tx,
    });
    return row ? row.get({ plain: true }) : null;
  }

  async replaceRecipients(campaignId, normalizedEmails, tx) {
    const unique = Array.from(new Set(normalizedEmails));
    if (unique.length === 0) {
      await CampaignRecipient.destroy({
        where: { campaign_id: campaignId },
        transaction: tx,
      });
      return [];
    }

    // Upsert with a no-op DO UPDATE so RETURNING fires for both new and
    // existing rows — gives us the id for each email in a single roundtrip.
    const values = unique.map((_, i) => `(:e${i})`).join(", ");
    const replacements = { ids: [] };
    unique.forEach((email, i) => {
      replacements[`e${i}`] = email;
    });

    const upserted = await sequelize.query(
      `INSERT INTO recipients (email)
       VALUES ${values}
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id, email`,
      {
        replacements,
        type: QueryTypes.SELECT,
        transaction: tx,
      },
    );

    const recipientIds = upserted.map((r) => r.id);

    // Drop links that no longer belong, then insert the current set.
    await CampaignRecipient.destroy({
      where: {
        campaign_id: campaignId,
        recipient_id: { [Op.notIn]: recipientIds },
      },
      transaction: tx,
    });

    await CampaignRecipient.bulkCreate(
      recipientIds.map((rid) => ({
        campaign_id: campaignId,
        recipient_id: rid,
        status: "pending",
      })),
      { ignoreDuplicates: true, transaction: tx },
    );

    return recipientIds;
  }

  async countRecipients(campaignId, tx) {
    return CampaignRecipient.count({
      where: { campaign_id: campaignId },
      transaction: tx,
    });
  }

  async markAllPendingAsSent(campaignId, { failureRate, openRate, now }, tx) {
    await sequelize.query(
      `WITH rolled AS (
         SELECT campaign_id,
                recipient_id,
                random() < :failureRate AS will_fail,
                random() < :openRate    AS will_open
           FROM campaign_recipients
          WHERE campaign_id = :campaignId
            AND status = 'pending'
            FOR UPDATE
       )
       UPDATE campaign_recipients cr
          SET status    = CASE WHEN r.will_fail THEN 'failed' ELSE 'sent' END,
              sent_at   = CASE WHEN r.will_fail THEN NULL     ELSE CAST(:now AS timestamptz) END,
              opened_at = CASE WHEN NOT r.will_fail AND r.will_open THEN CAST(:now AS timestamptz) END
         FROM rolled r
        WHERE cr.campaign_id  = r.campaign_id
          AND cr.recipient_id = r.recipient_id`,
      {
        replacements: { campaignId, failureRate, openRate, now },
        transaction: tx,
      },
    );
  }

  async getStats(campaignId, createdBy, tx) {
    if (!isUuid(campaignId) || !isUuid(createdBy)) return null;
    const [row] = await sequelize.query(
      `SELECT COUNT(cr.*)::int                                         AS total,
              COUNT(*) FILTER (WHERE cr.status = 'sent')::int          AS sent,
              COUNT(*) FILTER (WHERE cr.status = 'failed')::int        AS failed,
              COUNT(*) FILTER (WHERE cr.opened_at IS NOT NULL)::int    AS opened
         FROM campaigns c
    LEFT JOIN campaign_recipients cr ON cr.campaign_id = c.id
        WHERE c.id         = :campaignId
          AND c.created_by = :createdBy
     GROUP BY c.id`,
      {
        replacements: { campaignId, createdBy },
        type: QueryTypes.SELECT,
        transaction: tx,
      },
    );
    return row || null;
  }

  // Used by tests + possibly debug: confirm two campaigns share a recipient row.
  async findRecipientByEmail(email, tx) {
    const row = await Recipient.findOne({
      where: { email: email.toLowerCase() },
      transaction: tx,
    });
    return row ? row.get({ plain: true }) : null;
  }
}

module.exports = CampaignsRepository;
