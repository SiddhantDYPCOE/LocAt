
import { z } from "zod";

// Create or retrieve a direct conversation
export const createConversationSchema = z.object({
  recipientId: z.string().cuid("Invalid recipient ID")
});

// Send a text message
export const sendMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(5000, "Message cannot exceed 5000 characters")
});

