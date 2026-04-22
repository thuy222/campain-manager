process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DATABASE_URL_TEST =
  process.env.DATABASE_URL_TEST ||
  "postgresql://postgres:postgres@localhost:5434/campaign_manager_test";
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
