const { z } = require("zod");

const STATUSES = ["draft", "scheduled", "sent"];

const listCampaignsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(STATUSES).optional(),
});

module.exports = { listCampaignsSchema, STATUSES };
