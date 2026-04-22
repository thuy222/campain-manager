const { z } = require("zod");

const loginSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Must be a valid email address"),
  password: z.string({ required_error: "Password is required" }).min(1),
});

module.exports = { loginSchema };
