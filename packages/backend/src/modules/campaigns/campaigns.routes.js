const express = require("express");
const CampaignsService = require("./campaigns.service");
const CampaignsController = require("./campaigns.controller");

const service = new CampaignsService();
const controller = new CampaignsController(service);

const router = express.Router();

router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
