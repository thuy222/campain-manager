const express = require("express");

const validate = require("../../middleware/validate");
const buildRequireAuth = require("../../middleware/requireAuth");
const { authRepository } = require("../auth/auth.routes");

const CampaignsRepository = require("./campaigns.repository");
const CampaignsService = require("./campaigns.service");
const CampaignsController = require("./campaigns.controller");

const { createCampaignSchema } = require("./dto/create-campaign.dto");
const { updateCampaignSchema } = require("./dto/update-campaign.dto");
const { scheduleCampaignSchema } = require("./dto/schedule-campaign.dto");
const { listCampaignsSchema } = require("./dto/list-campaigns.dto");
const { idParamSchema } = require("./dto/id-param.dto");

const repository = new CampaignsRepository();
const service = new CampaignsService(repository);
const controller = new CampaignsController(service);
const requireAuth = buildRequireAuth(authRepository);

const router = express.Router();
router.use(requireAuth);

router.get("/", validate({ query: listCampaignsSchema }), controller.list);
router.post("/", validate({ body: createCampaignSchema }), controller.create);
router.get("/:id", validate({ params: idParamSchema }), controller.get);
router.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateCampaignSchema }),
  controller.update,
);
router.delete("/:id", validate({ params: idParamSchema }), controller.remove);
router.post(
  "/:id/schedule",
  validate({ params: idParamSchema, body: scheduleCampaignSchema }),
  controller.schedule,
);
router.post("/:id/send", validate({ params: idParamSchema }), controller.send);
router.get("/:id/stats", validate({ params: idParamSchema }), controller.stats);

module.exports = router;
