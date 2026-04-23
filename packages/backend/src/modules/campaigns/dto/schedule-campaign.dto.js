const { z } = require("zod");

// ISO-8601 with an explicit timezone offset (Z or +HH:MM / -HH:MM). Strings
// without an offset are ambiguous (spec edge case) and rejected here before
// Date coercion.
const ISO_WITH_OFFSET_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

const scheduleCampaignSchema = z.object({
  scheduled_at: z
    .string({ required_error: "scheduled_at is required" })
    .regex(
      ISO_WITH_OFFSET_RE,
      "scheduled_at must be an ISO-8601 timestamp with an explicit timezone offset",
    )
    .transform((s, ctx) => {
      const date = new Date(s);
      if (Number.isNaN(date.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "scheduled_at is not a valid date",
        });
        return z.NEVER;
      }
      return date;
    }),
});

module.exports = { scheduleCampaignSchema };
