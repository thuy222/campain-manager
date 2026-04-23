"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "CREATE INDEX campaigns_scheduled_at_idx ON campaigns (scheduled_at) " +
        "WHERE status = 'scheduled'",
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query("DROP INDEX IF EXISTS campaigns_scheduled_at_idx");
  },
};
