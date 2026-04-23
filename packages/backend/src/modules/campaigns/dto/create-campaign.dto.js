const { z } = require("zod");

const MAX_RECIPIENTS = 100;

const recipientEmailSchema = z
  .string({ required_error: "Recipient email is required" })
  .trim()
  .toLowerCase()
  .email("Must be a valid email address");

const recipientsArraySchema = z
  .array(recipientEmailSchema, { required_error: "Recipients are required" })
  .min(1, "At least one recipient required")
  .max(MAX_RECIPIENTS, `No more than ${MAX_RECIPIENTS} recipients allowed`)
  .transform((emails) => Array.from(new Set(emails)));

const createCampaignSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(1, "Name is required")
    .max(255, "Name must be 255 characters or fewer"),
  subject: z
    .string({ required_error: "Subject is required" })
    .trim()
    .min(1, "Subject is required")
    .max(255, "Subject must be 255 characters or fewer"),
  body: z.string({ required_error: "Body is required" }).min(1, "Body is required"),
  recipients: recipientsArraySchema,
});

module.exports = {
  createCampaignSchema,
  recipientsArraySchema,
  MAX_RECIPIENTS,
};
