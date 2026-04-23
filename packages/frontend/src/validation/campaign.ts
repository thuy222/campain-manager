import { z, ZodError } from "zod";

export const MAX_RECIPIENTS = 100;

const recipientEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: "Must be a valid email address" });

export const createCampaignSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(255, { message: "Name must be 255 characters or fewer" }),
  subject: z
    .string()
    .trim()
    .min(1, { message: "Subject is required" })
    .max(255, { message: "Subject must be 255 characters or fewer" }),
  body: z.string().min(1, { message: "Body is required" }),
  recipients: z
    .array(recipientEmail)
    .min(1, { message: "At least one recipient required" })
    .max(MAX_RECIPIENTS, {
      message: `No more than ${MAX_RECIPIENTS} recipients allowed`,
    }),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export type CreateCampaignValues = z.infer<typeof createCampaignSchema>;

export function zodIssuesToFieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
