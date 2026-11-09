
import prisma from "../../db.js";
import { sendTextMessage } from "./chat.service.js";

const registerChatSocket = (io, socket) => {
  const userId = socket.user.userId;

  console.log(`Chat socket initialized for user: ${userId}`);

  socket.emit("chat:connected", {
    success: true,
    message: "Connected to LocAt chat",
    userId
  });

  // JOIN CONVERSATION
  socket.on("chat:join", async (data, acknowledge) => {
    try {
      const { conversationId } = data || {};

      if (!conversationId) {
        throw new Error("Conversation ID is required");
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          members: {
            select: { userId: true }
          }
        }
      });

      if (!conversation) {
        throw new Error("Conversation not found");
      }

      const isMember = conversation.members.some(
        (member) => member.userId === userId
      );

      if (!isMember) {
        throw new Error("You are not a member of this conversation");
      }

      if (conversation.type === "DIRECT") {
        const recipient = conversation.members.find(
          (member) => member.userId !== userId
        );

        if (!recipient) {
          throw new Error("Conversation recipient not found");
        }

        const [userAId, userBId] = [
          userId,
          recipient.userId
        ].sort();

        const connection = await prisma.connection.findFirst({
          where: {
            userAId,
            userBId,
            status: "ACCEPTED"
          }
        });

        if (!connection) {
          throw new Error(
            "You can only access chats with accepted connections"
          );
        }
      }

      const room = `conversation:${conversationId}`;

      await socket.join(room);

      acknowledge?.({
        success: true,
        message: "Joined conversation successfully",
        conversationId
      });
    } catch (error) {
      acknowledge?.({
        success: false,
        message: error.message
      });
    }
  });

  // LEAVE CONVERSATION
  socket.on("chat:leave", async (data, acknowledge) => {
    try {
      const { conversationId } = data || {};

      if (!conversationId) {
        throw new Error("Conversation ID is required");
      }

      await socket.leave(`conversation:${conversationId}`);

      acknowledge?.({
        success: true,
        message: "Left conversation successfully"
      });
    } catch (error) {
      acknowledge?.({
        success: false,
        message: error.message
      });
    }
  });

  // SEND MESSAGE
  socket.on("chat:send", async (data, acknowledge) => {
    try {
      const { conversationId, content } = data || {};

      if (
        typeof conversationId !== "string" ||
        typeof content !== "string"
      ) {
        throw new Error("Invalid message data");
      }

      const trimmedContent = content.trim();

      if (!trimmedContent) {
        throw new Error("Message cannot be empty");
      }

      if (trimmedContent.length > 5000) {
        throw new Error("Message cannot exceed 5000 characters");
      }

      const room = `conversation:${conversationId}`;

      if (!socket.rooms.has(room)) {
        throw new Error("Join the conversation before sending messages");
      }

      // Save message using existing chat service
      const message = await sendTextMessage(
        userId,
        conversationId,
        trimmedContent
      );

      // Broadcast saved message to all conversation members
      io.to(room).emit("chat:new-message", message);

      acknowledge?.({
        success: true,
        message: "Message sent successfully",
        data: message
      });
    } catch (error) {
      acknowledge?.({
        success: false,
        message: error.message
      });
    }
  });
};

export default registerChatSocket;
