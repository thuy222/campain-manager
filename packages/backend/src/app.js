require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const authRoutes = require("./modules/auth/auth.routes");
const campaignsRoutes = require("./modules/campaigns/campaigns.routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

if (corsOrigin === "*") {
  throw new Error(
    "CORS_ORIGIN=* is incompatible with credentialed requests — set a concrete origin",
  );
}

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({ data: { status: "ok", service: "campaign-manager-backend" } });
});

app.use("/api/auth", authRoutes);
app.use("/api/campaigns", campaignsRoutes);

app.use(errorHandler);

module.exports = app;
