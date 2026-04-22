require("dotenv").config();

const { Sequelize } = require("sequelize");
const config = require("./config");

const env = process.env.NODE_ENV || "development";
const cfg = config[env];

if (!cfg || !cfg.url) {
  throw new Error(
    `No database URL configured for NODE_ENV="${env}". Set DATABASE_URL (or DATABASE_URL_TEST for tests).`,
  );
}

const sequelize = new Sequelize(cfg.url, {
  dialect: cfg.dialect,
  logging: cfg.logging,
  define: cfg.define,
});

module.exports = { sequelize };
