const { z } = require("zod");
const { recipientsArraySchema } = require("./create-campaign.dto");

const updateCampaignSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(255, "Name must be 255 characters or fewer"),
    subject: z
      .string()
      .trim()
      .min(1, "Subject is required")
      .max(255, "Subject must be 255 characters or fewer"),
    body: z.string().min(1, "Body is required"),
    recipients: recipientsArraySchema,
  })
  .partial()
  .strict({ message: "Unknown field" })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
    path: ["_"],
  });

module.exports = { updateCampaignSchema };
