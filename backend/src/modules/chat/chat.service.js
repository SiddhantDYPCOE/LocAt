
import prisma from "../../db.js";

// Generate a consistent key for a pair of users
const generateDirectKey = (userId1, userId2) => {
  return [userId1, userId2].sort().join("_");
};

// Check whether two users are accepted connections
const verifyAcceptedConnection = async (userId1, userId2) => {
  const [userAId, userBId] = [userId1, userId2].sort();

  const connection = await prisma.connection.findFirst({
    where: {
      userAId,
      userBId,
      status: "ACCEPTED"
    }
  });

  if (!connection) {
    throw new Error("You can only chat with accepted connections");
  }
};

// Verify conversation membership
const verifyConversationMember = async (conversationId, userId) => {
  const member = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId
      }
    }
  });

  if (!member) {
    throw new Error("You are not a member of this conversation");
  }

  return member;
};


// Create or retrieve a direct conversation
export const createOrGetConversation = async (userId, recipientId) => {
  if (userId === recipientId) {
    throw new Error("You cannot create a conversation with yourself");
  }

  await verifyAcceptedConnection(userId, recipientId);

  const directKey = generateDirectKey(userId, recipientId);

  const conversation = await prisma.conversation.upsert({
    where: {
      directKey
    },
    update: {},
    create: {
      type: "DIRECT",
      directKey,
      members: {
        create: [
          { userId },
          { userId: recipientId }
        ]
      }
    },
    include: {
      members: {
        select: {
          userId: true,
          joinedAt: true
        }
      }
    }
  });

  // Ensure both users are members, including for an existing conversation.
  const existingMemberIds = conversation.members.map(
    (member) => member.userId
  );

  const missingMembers = [userId, recipientId]
    .filter((id) => !existingMemberIds.includes(id));

  if (missingMembers.length > 0) {
    await prisma.conversationMember.createMany({
      data: missingMembers.map((memberId) => ({
        conversationId: conversation.id,
        userId: memberId
      })),
      skipDuplicates: true
    });
  }

  return conversation;
};


// Send a text message
export const sendTextMessage = async (
  userId,
  conversationId,
  content
) => {
  await verifyConversationMember(conversationId, userId);

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

  if (conversation.type === "DIRECT") {
    const recipient = conversation.members.find(
      (member) => member.userId !== userId
    );

    if (!recipient) {
      throw new Error("Conversation recipient not found");
    }

    await verifyAcceptedConnection(userId, recipient.userId);
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: userId,
      type: "TEXT",
      content
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          username: true,
          avatarUrl: true
        }
      }
    }
  });

  return message;
};


// Get the latest 50 messages
export const getConversationMessages = async (
  userId,
  conversationId
) => {
  await verifyConversationMember(conversationId, userId);

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

  if (conversation.type === "DIRECT") {
    const recipient = conversation.members.find(
      (member) => member.userId !== userId
    );

    if (!recipient) {
      throw new Error("Conversation recipient not found");
    }

    await verifyAcceptedConnection(userId, recipient.userId);
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      deletedAt: null
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 50,
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          username: true,
          avatarUrl: true
        }
      }
    }
  });

  return messages.reverse();
};

export const getMyConversations = async (userId) => {
  // Fetch all conversations the user belongs to.
  const memberships = await prisma.conversationMember.findMany({
    where: {
      userId,
    },
    include: {
      conversation: {
        include: {
          members: {
            where: {
              userId: {
                not: userId,
              },
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  avatarUrl: true,
                },
              },
            },
          },
          messages: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
            select: {
              id: true,
              content: true,
              type: true,
              senderId: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  const conversations = memberships.map(({ conversation }) => {
    const recipient = conversation.members[0];

    return {
      id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      updatedAt: conversation.updatedAt,
      user: recipient?.user || null,
      lastMessage: conversation.messages[0] || null,
    };
  });

  // Show the most recently updated conversation first.
  conversations.sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );

  return conversations;
};