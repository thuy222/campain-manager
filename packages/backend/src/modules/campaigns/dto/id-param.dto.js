const { z } = require("zod");

// Accepts anything that looks like a UUID string; invalid IDs are handled at the
// service layer as 404 NOT_FOUND so malformed vs. non-existent look identical
// to the caller (ownership-leak rule).
const idParamSchema = z.object({
  id: z.string().min(1),
});

module.exports = { idParamSchema };
