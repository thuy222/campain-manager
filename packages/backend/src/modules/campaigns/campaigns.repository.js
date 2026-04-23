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

  async findByIdWithRecipientCount(id, createdBy, tx) {
    if (!isUuid(id) || !isUuid(createdBy)) return null;
    const [row] = await sequelize.query(
      `SELECT c.id, c.name, c.subject, c.body, c.status, c.scheduled_at,
              c.created_by, c.created_at, c.updated_at,
              COALESCE(rl.cnt,    0)              AS recipient_count,
              COALESCE(rl.emails, ARRAY[]::text[]) AS recipients
         FROM campaigns c
    LEFT JOIN (
           SELECT cr.campaign_id,
                  COUNT(*)::int                        AS cnt,
                  ARRAY_AGG(r.email ORDER BY r.email)  AS emails
             FROM campaign_recipients cr
             JOIN recipients r ON r.id = cr.recipient_id
            WHERE cr.campaign_id = :id
            GROUP BY cr.campaign_id
         ) rl ON rl.campaign_id = c.id
        WHERE c.id = :id
          AND c.created_by = :createdBy`,
      {
        replacements: { id, createdBy },
        type: QueryTypes.SELECT,
        transaction: tx,
      },
    );
    if (!row) return null;
    return {
      ...row,
      recipient_count: Number(row.recipient_count),
      recipients: row.recipients || [],
    };
  }

  async findByOwner({ createdBy, status, limit, offset }, tx) {
    if (!isUuid(createdBy)) return { rows: [], count: 0 };
    // Single roundtrip when the page has rows: a LEFT JOIN to pre-aggregated
    // recipient counts, plus COUNT(*) OVER() for the total. Falls back to a
    // standalone count query only for the empty-page edge (so a UI that
    // paginates past the end still sees the correct total).
    const rows = await sequelize.query(
      `SELECT c.id, c.name, c.subject, c.body, c.status, c.scheduled_at,
              c.created_by, c.created_at, c.updated_at,
              COALESCE(rc.cnt, 0) AS recipient_count,
              COUNT(*) OVER()     AS total_count
         FROM campaigns c
    LEFT JOIN (
           SELECT campaign_id, COUNT(*)::int AS cnt
             FROM campaign_recipients
            GROUP BY campaign_id
         ) rc ON rc.campaign_id = c.id
        WHERE c.created_by = :createdBy
          AND (:status::text IS NULL OR c.status = :status)
        ORDER BY c.created_at DESC
        LIMIT :limit OFFSET :offset`,
      {
        replacements: { createdBy, status: status ?? null, limit, offset },
        type: QueryTypes.SELECT,
        transaction: tx,
      },
    );

    if (rows.length === 0) {
      const [{ count }] = await sequelize.query(
        `SELECT COUNT(*)::int AS count
           FROM campaigns
          WHERE created_by = :createdBy
            AND (:status::text IS NULL OR status = :status)`,
        {
          replacements: { createdBy, status: status ?? null },
          type: QueryTypes.SELECT,
          transaction: tx,
        },
      );
      return { rows: [], count };
    }

    const count = Number(rows[0].total_count);
    const items = rows.map(({ total_count, recipient_count, ...r }) => ({
      ...r,
      recipient_count: Number(recipient_count),
    }));
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
