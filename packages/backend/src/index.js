require("dotenv").config();

const REQUIRED_ENV = ["JWT_SECRET", "DATABASE_URL"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(
    `\nMissing required environment variables: ${missing.join(", ")}\n` +
      `Copy packages/backend/.env.example to packages/backend/.env and fill in values.\n`,
  );
  process.exit(1);
}

const app = require("./app");

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
