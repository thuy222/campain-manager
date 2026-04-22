const { execSync } = require("node:child_process");
const path = require("node:path");

module.exports = async function globalSetup() {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
  process.env.DATABASE_URL_TEST =
    process.env.DATABASE_URL_TEST ||
    "postgresql://postgres:postgres@localhost:5434/campaign_manager_test";

  const backendRoot = path.resolve(__dirname, "..");
  execSync("npx sequelize-cli db:migrate", {
    cwd: backendRoot,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "test" },
  });
};
