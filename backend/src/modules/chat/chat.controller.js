
import {
  createOrGetConversation,
  sendTextMessage,
  getConversationMessages
} from "./chat.service.js";

// Create or retrieve a direct conversation
export const createConversation = async (req, res, next) => {
  try {
    const conversation = await createOrGetConversation(
      req.user.userId,
      req.body.recipientId
    );

    return res.status(200).json({
      success: true,
      message: "Conversation retrieved successfully",
      conversation
    });
  } catch (error) {
    handleChatError(error, res, next);
  }
};


// Send a text message
export const sendMessage = async (req, res, next) => {
  try {
    const message = await sendTextMessage(
      req.user.userId,
      req.params.conversationId,
      req.body.content
    );

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: message
    });
  } catch (error) {
    handleChatError(error, res, next);
  }
};


// Get conversation messages
export const getMessages = async (req, res, next) => {
  try {
    const messages = await getConversationMessages(
      req.user.userId,
      req.params.conversationId
    );

    return res.status(200).json({
      success: true,
      count: messages.length,
      messages
    });
  } catch (error) {
    handleChatError(error, res, next);
  }
};


// Centralized chat error handling
const handleChatError = (error, res, next) => {
  const notFoundErrors = [
    "Conversation not found",
    "Conversation recipient not found"
  ];

  const forbiddenErrors = [
    "You are not a member of this conversation",
    "You can only chat with accepted connections"
  ];

  const conflictErrors = [
    "You cannot create a conversation with yourself"
  ];

  if (notFoundErrors.includes(error.message)) {
    return res.status(404).json({
      success: false,
      message: error.message
    });
  }

  if (forbiddenErrors.includes(error.message)) {
    return res.status(403).json({
      success: false,
      message: error.message
    });
  }

  if (conflictErrors.includes(error.message)) {
    return res.status(409).json({
      success: false,
      message: error.message
    });
  }

  next(error);
};
