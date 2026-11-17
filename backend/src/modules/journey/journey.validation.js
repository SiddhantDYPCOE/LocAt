
import { z } from "zod";

// ========================================
// CREATE JOURNEY
// ========================================

export const createJourneySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Journey name cannot be empty")
    .max(80, "Journey name cannot exceed 80 characters")
    .nullable()
    .optional(),

  destinationName: z
    .string()
    .trim()
    .min(1, "Destination name is required")
    .max(150, "Destination name cannot exceed 150 characters"),

  destinationAddress: z
    .string()
    .trim()
    .max(300, "Destination address cannot exceed 300 characters")
    .nullable()
    .optional(),

  destinationLat: z.number().min(-90).max(90),
  destinationLng: z.number().min(-180).max(180),

  // Creator's starting location
  originName: z
    .string()
    .trim()
    .max(150)
    .nullable()
    .optional(),

  originAddress: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .optional(),

  originLat: z.number().min(-90).max(90),
  originLng: z.number().min(-180).max(180),

  // Accepted connections to invite
  invitedUserIds: z
    .array(z.string().min(1))
    .max(100)
    .default([])
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Duplicate invitees are not allowed"
    )
});

// ========================================
// JOURNEY ID
// ========================================

export const journeyIdSchema = z.object({
  journeyId: z.string().cuid("Invalid journey ID")
});

// ========================================
// RESPOND TO JOURNEY INVITATION
// ========================================

export const respondJourneyInvitationSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"])
});

// ========================================
// UPDATE MEMBER LOCATION
// ========================================

export const journeyLocationUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),

  speed: z.number().min(0).nullable().optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
  accuracy: z.number().min(0).nullable().optional()
});

// ========================================
// UPDATE MEMBER ORIGIN
// ========================================

export const journeyOriginSchema = z.object({
  originName: z
    .string()
    .trim()
    .max(150)
    .nullable()
    .optional(),

  originAddress: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .optional(),

  originLat: z.number().min(-90).max(90),
  originLng: z.number().min(-180).max(180)
});
