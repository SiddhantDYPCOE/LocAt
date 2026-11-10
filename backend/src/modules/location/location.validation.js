
import { z } from "zod";

// Start individual location sharing
export const startLocationShareSchema = z.object({
  recipientIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one recipient")
    .max(100)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Duplicate recipients are not allowed"
    ),

  // Expiry duration in minutes.
  // null means no automatic expiry.
  expiresInMinutes: z
    .number()
    .int()
    .min(1)
    .max(1440)
    .nullable()
    .optional()
});

// GPS location update
export const locationUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),

  speed: z.number().min(0).nullable().optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
  accuracy: z.number().min(0).nullable().optional()
});

// Validate location share ID
export const locationShareIdSchema = z.object({
  shareId: z.string().min(1, "Share ID is required")
});
