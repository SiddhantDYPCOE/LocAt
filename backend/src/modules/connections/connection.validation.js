
import { z } from "zod";

export const sendRequestSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must contain at least 3 characters")
    .max(20, "Username cannot exceed 20 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Invalid username format"
    )
});

export const connectionActionSchema = z.object({
  connectionId: z
    .string()
    .cuid("Invalid connection ID")
});

