"use strict";

const bcrypt = require("bcrypt");

const DEMO_EMAIL = "demo@example.com";
const DEMO_NAME = "Demo User";
const DEMO_PASSWORD = "password123";
const BCRYPT_COST = 10;

module.exports = {
  async up(queryInterface) {
    const [existing] = await queryInterface.sequelize.query(
      "SELECT id FROM users WHERE email = :email LIMIT 1",
      { replacements: { email: DEMO_EMAIL } },
    );
    if (existing.length > 0) return;

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST);
    await queryInterface.bulkInsert("users", [
      {
        email: DEMO_EMAIL,
        name: DEMO_NAME,
        password_hash: passwordHash,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("users", { email: DEMO_EMAIL });
  },
};
