
import prisma from "../../db.js";

const getSortedUserIds = (userId1, userId2) => {
  return [userId1, userId2].sort();
};

// Send a connection request
export const sendConnectionRequest = async (senderId, username) => {
  // Find recipient
  const recipient = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      name: true,
      username: true,
      avatarUrl: true
    }
  });

  if (!recipient) {
    throw new Error("User not found");
  }

  // Prevent sending request to yourself
  if (senderId === recipient.id) {
    throw new Error("You cannot send a request to yourself");
  }

  const [userAId, userBId] = getSortedUserIds(
    senderId,
    recipient.id
  );

  // Check whether a connection already exists
  const existingConnection = await prisma.connection.findFirst({
    where: {
      userAId,
      userBId
    }
  });

  if (existingConnection) {
    // Blocked connections cannot receive requests
    if (existingConnection.status === "BLOCKED") {
      throw new Error("Connection request is not allowed");
    }

    // Already connected
    if (existingConnection.status === "ACCEPTED") {
      throw new Error("You are already connected");
    }

    // Both users sent requests to each other.
    // Automatically accept the existing request.
    if (
      existingConnection.status === "PENDING" &&
      existingConnection.requestedById !== senderId
    ) {
      return await prisma.connection.update({
        where: {
          id: existingConnection.id
        },
        data: {
          status: "ACCEPTED"
        }
      });
    }

    // Sender has already sent a pending request
    if (existingConnection.status === "PENDING") {
      throw new Error("Connection request already sent");
    }

    // Previous request was rejected.
    // Allow a fresh request.
    if (existingConnection.status === "REJECTED") {
      return await prisma.connection.update({
        where: {
          id: existingConnection.id
        },
        data: {
          status: "PENDING",
          requestedById: senderId
        }
      });
    }
  }

  // Create a new connection request
  return await prisma.connection.create({
    data: {
      userAId,
      userBId,
      requestedById: senderId,
      status: "PENDING"
    }
  });
};



// Accept a connection request
export const acceptConnectionRequest = async (userId, connectionId) => {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId }
  });

  if (!connection) {
    throw new Error("Connection request not found");
  }

  // Only the recipient can accept the request
  if (connection.requestedById === userId) {
    throw new Error("You cannot accept your own request");
  }

  // Verify that the user is part of this connection
  if (
    connection.userAId !== userId &&
    connection.userBId !== userId
  ) {
    throw new Error("You are not authorized to accept this request");
  }

  if (connection.status !== "PENDING") {
    throw new Error("This request is no longer pending");
  }

  return await prisma.connection.update({
    where: { id: connectionId },
    data: { status: "ACCEPTED" }
  });
};


// Reject a connection request
export const rejectConnectionRequest = async (userId, connectionId) => {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId }
  });

  if (!connection) {
    throw new Error("Connection request not found");
  }

  // Only the recipient can reject the request
  if (connection.requestedById === userId) {
    throw new Error("You cannot reject your own request");
  }

  if (
    connection.userAId !== userId &&
    connection.userBId !== userId
  ) {
    throw new Error("You are not authorized to reject this request");
  }

  if (connection.status !== "PENDING") {
    throw new Error("This request is no longer pending");
  }

  return await prisma.connection.update({
    where: { id: connectionId },
    data: { status: "REJECTED" }
  });
};


// Remove an accepted connection
export const removeConnection = async (userId, connectionId) => {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId }
  });

  if (!connection) {
    throw new Error("Connection not found");
  }

  if (
    connection.userAId !== userId &&
    connection.userBId !== userId
  ) {
    throw new Error("You are not authorized to remove this connection");
  }

  if (connection.status !== "ACCEPTED") {
    throw new Error("Only accepted connections can be removed");
  }

  return await prisma.connection.delete({
    where: { id: connectionId }
  });
};


// Helper: attach the other user's profile to each connection
const attachConnectionUsers = async (connections, currentUserId) => {
  const otherUserIds = connections.map((connection) =>
    connection.userAId === currentUserId
      ? connection.userBId
      : connection.userAId
  );

  const users = await prisma.user.findMany({
    where: {
      id: { in: otherUserIds }
    },
    select: {
      id: true,
      name: true,
      username: true,
      avatarUrl: true,
      bio: true
    }
  });

  const userMap = new Map(
    users.map((user) => [user.id, user])
  );

  return connections.map((connection) => {
    const otherUserId =
      connection.userAId === currentUserId
        ? connection.userBId
        : connection.userAId;

    return {
      ...connection,
      user: userMap.get(otherUserId) || null
    };
  });
};


// Get all accepted connections
export const getMyConnections = async (userId) => {
  const connections = await prisma.connection.findMany({
    where: {
      OR: [
        { userAId: userId },
        { userBId: userId }
      ],
      status: "ACCEPTED"
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  return attachConnectionUsers(connections, userId);
};


// Get incoming pending requests
export const getIncomingRequests = async (userId) => {
  const connections = await prisma.connection.findMany({
    where: {
  OR: [
    { userAId: userId },
    { userBId: userId }
  ],
  requestedById: { not: userId },
  status: "PENDING"
},
    orderBy: {
      updatedAt: "desc"
    }
  });

  return attachConnectionUsers(connections, userId);
};


// Get outgoing pending requests
export const getOutgoingRequests = async (userId) => {
  const connections = await prisma.connection.findMany({
    where: {
      OR: [
        { userAId: userId },
        { userBId: userId }
      ],
      requestedById: userId,
      status: "PENDING"
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  return attachConnectionUsers(connections, userId);
};


export const searchUsers = async (currentUserId, searchQuery) => {
  const query = searchQuery.trim();

  if (query.length < 2) {
    throw new Error("Search query must contain at least 2 characters");
  }

  const users = await prisma.user.findMany({
    where: {
      id: {
        not: currentUserId
      },
      OR: [
        {
          username: {
            contains: query,
            mode: "insensitive"
          }
        },
        {
          name: {
            contains: query,
            mode: "insensitive"
          }
        }
      ]
    },
    select: {
      id: true,
      name: true,
      username: true,
      avatarUrl: true,
      bio: true
    },
    take: 20,
    orderBy: {
      username: "asc"
    }
  });

  return users;
};
