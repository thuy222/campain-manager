require("dotenv").config();

const common = {
  dialect: "postgres",
  logging: false,
  define: {
    underscored: true,
    timestamps: true,
  },
};

module.exports = {
  development: {
    ...common,
    url:
      process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5434/campaign_manager",
  },
  test: {
    ...common,
    url:
      process.env.DATABASE_URL_TEST ||
      "postgresql://postgres:postgres@localhost:5434/campaign_manager_test",
  },
  production: {
    ...common,
    url: process.env.DATABASE_URL,
  },
};
