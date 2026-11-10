
import { Router } from "express";

import {
  createConversation,
  sendMessage,
  getMessages,
  getConversations,
  markAsRead
} from "./chat.controller.js";

import {
  createConversationSchema,
  sendMessageSchema
} from "./chat.validation.js";

import validate from "../../middlewares/validate.middleware.js";
import protect from "../../middlewares/auth.middleware.js";

const router = Router();

// All chat routes require authentication
router.use(protect);

// Create or retrieve a private conversation
router.post(
  "/conversation",
  validate(createConversationSchema),
  createConversation
);

router.patch("/:conversationId/read", markAsRead);

// Send a text message
router.post(
  "/:conversationId/messages",
  validate(sendMessageSchema),
  sendMessage
);

// Retrieve conversation messages
router.get(
  "/:conversationId/messages",
  getMessages
);
router.get("/conversations", getConversations);

export default router;
