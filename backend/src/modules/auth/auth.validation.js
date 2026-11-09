
import { z } from "zod";

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must contain at least 2 characters")
    .max(50, "Name cannot exceed 50 characters"),

  username: z
    .string()
    .trim()
    .min(3, "Username must contain at least 3 characters")
    .max(20, "Username cannot exceed 20 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers and underscores"
    ),

  email: z
    .string()
    .trim()
    .email("Please provide a valid email")
    .toLowerCase(),

  password: z
    .string()
    .min(8, "Password must contain at least 8 characters")
    .max(72, "Password cannot exceed 72 characters")
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please provide a valid email")
    .toLowerCase(),

  password: z
    .string()
    .min(1, "Password is required")
});

