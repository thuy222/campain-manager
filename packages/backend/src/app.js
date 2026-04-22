const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const campaignsRoutes = require("./modules/campaigns/campaigns.routes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "campaign-manager-backend" });
});

app.use("/api/campaigns", campaignsRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res
    .status(err.status || 500)
    .json({ error: err.message || "Internal Server Error" });
});

module.exports = app;
