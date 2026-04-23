import { z } from "zod";

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Email is required" })
    .email({ message: "Must be a valid email address" }),
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(255, { message: "Name must be 255 characters or fewer" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
});

export type RegisterValues = z.infer<typeof registerSchema>;
