
import prisma from "../../db.js";

// Verify that two users have an accepted connection
const verifyAcceptedConnection = async (userId1, userId2) => {
  const userAId = userId1 < userId2 ? userId1 : userId2;
  const userBId = userId1 < userId2 ? userId2 : userId1;

  return prisma.connection.findFirst({
    where: {
      userAId,
      userBId,
      status: "ACCEPTED"
    }
  });
};

// Start individual location sharing
export const startLocationShare = async (
  ownerId,
  recipientIds,
  expiresInMinutes
) => {
  if (recipientIds.includes(ownerId)) {
    throw new Error("You cannot share your location with yourself");
  }

  // Validate every recipient's connection
  for (const recipientId of recipientIds) {
    const connection = await verifyAcceptedConnection(
      ownerId,
      recipientId
    );

    if (!connection) {
      throw new Error(
        "You can only share your location with accepted connections"
      );
    }
  }

  // Calculate expiry time
  const expiresAt = expiresInMinutes
    ? new Date(Date.now() + expiresInMinutes * 60 * 1000)
    : null;

  // Create location share and recipients
  const locationShare = await prisma.locationShare.create({
    data: {
      ownerId,
      status: "ACTIVE",
      expiresAt,

      recipients: {
        create: recipientIds.map((userId) => ({
          userId
        }))
      }
    },
    include: {
      recipients: {
        select: {
          userId: true
        }
      },
      owner: {
        select: {
          id: true,
          name: true,
          username: true,
          avatarUrl: true
        }
      }
    }
  });

  return locationShare;
};

// Get active location shares visible to a user
export const getActiveLocationShares = async (userId) => {
  const now = new Date();

  // Expire sessions whose expiry time has passed
  await prisma.locationShare.updateMany({
    where: {
      status: "ACTIVE",
      expiresAt: {
        lte: now
      }
    },
    data: {
      status: "EXPIRED",
      endedAt: now
    }
  });

  const shares = await prisma.locationShare.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        {
          ownerId: userId
        },
        {
          recipients: {
            some: {
              userId
            }
          }
        }
      ]
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          username: true,
          avatarUrl: true
        }
      },
      recipients: {
        select: {
          userId: true
        }
      }
    },
    orderBy: {
      startedAt: "desc"
    }
  });

  return shares;
};

// Update owner's latest GPS location
export const updateLocationShare = async (
  ownerId,
  shareId,
  locationData
) => {
  const share = await prisma.locationShare.findFirst({
    where: {
      id: shareId,
      ownerId,
      status: "ACTIVE"
    }
  });

  if (!share) {
    throw new Error("Active location share not found");
  }

  if (share.expiresAt && share.expiresAt <= new Date()) {
    await prisma.locationShare.update({
      where: {
        id: shareId
      },
      data: {
        status: "EXPIRED",
        endedAt: new Date()
      }
    });

    throw new Error("Location sharing session has expired");
  }

  const updatedShare = await prisma.locationShare.update({
    where: {
      id: shareId
    },
    data: {
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      speed: locationData.speed ?? null,
      heading: locationData.heading ?? null,
      accuracy: locationData.accuracy ?? null,
      lastUpdatedAt: new Date()
    }
  });

  return updatedShare;
};

// Stop location sharing
export const stopLocationShare = async (ownerId, shareId) => {
  const share = await prisma.locationShare.findFirst({
    where: {
      id: shareId,
      ownerId,
      status: "ACTIVE"
    }
  });

  if (!share) {
    throw new Error("Active location share not found");
  }

  return prisma.locationShare.update({
    where: {
      id: shareId
    },
    data: {
      status: "ENDED",
      endedAt: new Date()
    }
  });
};
