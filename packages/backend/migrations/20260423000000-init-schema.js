"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable(
        "users",
        {
          id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal("gen_random_uuid()"),
            allowNull: false,
            primaryKey: true,
          },
          email: { type: Sequelize.STRING(255), allowNull: false },
          name: { type: Sequelize.STRING(255), allowNull: false },
          password_hash: { type: Sequelize.STRING(255), allowNull: false },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        },
        { transaction },
      );

      await queryInterface.addIndex("users", {
        name: "users_email_unique",
        fields: ["email"],
        unique: true,
        transaction,
      });

      await queryInterface.createTable(
        "campaigns",
        {
          id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal("gen_random_uuid()"),
            allowNull: false,
            primaryKey: true,
          },
          name: { type: Sequelize.STRING(255), allowNull: false },
          subject: { type: Sequelize.STRING(255), allowNull: false },
          body: { type: Sequelize.TEXT, allowNull: false },
          status: {
            type: Sequelize.STRING(16),
            allowNull: false,
            defaultValue: "draft",
          },
          scheduled_at: { type: Sequelize.DATE, allowNull: true },
          created_by: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: "users", key: "id" },
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        },
        { transaction },
      );

      await queryInterface.sequelize.query(
        "ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check " +
          "CHECK (status IN ('draft','scheduled','sent'))",
        { transaction },
      );

      await queryInterface.addIndex("campaigns", {
        name: "campaigns_owner_created_at_idx",
        fields: [{ name: "created_by" }, { name: "created_at", order: "DESC" }],
        transaction,
      });

      await queryInterface.addIndex("campaigns", {
        name: "campaigns_owner_status_idx",
        fields: ["created_by", "status"],
        transaction,
      });

      // Partial index: only scheduled rows carry a meaningful scheduled_at, and
      // any future dispatcher will filter on that exact predicate.
      await queryInterface.sequelize.query(
        "CREATE INDEX campaigns_scheduled_at_idx ON campaigns (scheduled_at) " +
          "WHERE status = 'scheduled'",
        { transaction },
      );

      await queryInterface.createTable(
        "recipients",
        {
          id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal("gen_random_uuid()"),
            allowNull: false,
            primaryKey: true,
          },
          email: { type: Sequelize.STRING(320), allowNull: false },
          name: { type: Sequelize.STRING(255), allowNull: true },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        },
        { transaction },
      );

      // Emails are normalized to lowercase before insert (service + DTO), so a
      // plain UNIQUE on the column is enough. Using a functional index on
      // lower(email) instead would require every query to spell it the same
      // way — simpler to enforce normalization at write time.
      await queryInterface.addIndex("recipients", {
        name: "recipients_email_unique",
        fields: ["email"],
        unique: true,
        transaction,
      });

      await queryInterface.createTable(
        "campaign_recipients",
        {
          campaign_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: "campaigns", key: "id" },
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
          },
          recipient_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: "recipients", key: "id" },
            onDelete: "RESTRICT",
            onUpdate: "CASCADE",
          },
          status: {
            type: Sequelize.STRING(10),
            allowNull: false,
            defaultValue: "pending",
          },
          sent_at: { type: Sequelize.DATE, allowNull: true },
          opened_at: { type: Sequelize.DATE, allowNull: true },
        },
        { transaction },
      );

      await queryInterface.sequelize.query(
        "ALTER TABLE campaign_recipients " +
          "ADD CONSTRAINT campaign_recipients_pkey PRIMARY KEY (campaign_id, recipient_id)",
        { transaction },
      );

      await queryInterface.sequelize.query(
        "ALTER TABLE campaign_recipients ADD CONSTRAINT campaign_recipients_status_check " +
          "CHECK (status IN ('pending','sent','failed'))",
        { transaction },
      );

      await queryInterface.addIndex("campaign_recipients", {
        name: "campaign_recipients_campaign_status_idx",
        fields: ["campaign_id", "status"],
        transaction,
      });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable("campaign_recipients", { transaction });
      await queryInterface.dropTable("recipients", { transaction });
      await queryInterface.dropTable("campaigns", { transaction });
      await queryInterface.dropTable("users", { transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
