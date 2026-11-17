
import prisma from "../../db.js";

// ========================================
// SHARED QUERY HELPERS
// ========================================

const getSortedUserIds = (userId1, userId2) => {
  return [userId1, userId2].sort();
};

const verifyAcceptedConnection = async (userId1, userId2) => {
  const [userAId, userBId] = getSortedUserIds(userId1, userId2);

  return prisma.connection.findFirst({
    where: {
      userAId,
      userBId,
      status: "ACCEPTED"
    }
  });
};

const journeyInclude = {
  creator: {
    select: {
      id: true,
      name: true,
      username: true,
      avatarUrl: true
    }
  },
  members: {
    orderBy: {
      invitedAt: "asc"
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          avatarUrl: true
        }
      }
    }
  }
};

// ========================================
// CREATE JOURNEY
// ========================================

export const createJourney = async (userId, journeyData) => {
  const { invitedUserIds = [], ...data } = journeyData;

  if (invitedUserIds.includes(userId)) {
    throw new Error("You cannot invite yourself to a journey");
  }

  // Verify that every invitee is an accepted connection
  for (const invitedUserId of invitedUserIds) {
    const connection = await verifyAcceptedConnection(
      userId,
      invitedUserId
    );

    if (!connection) {
      throw new Error(
        "You can only invite accepted connections to a journey"
      );
    }
  }

  const journey = await prisma.journey.create({
    data: {
      name: data.name ?? null,
      createdById: userId,

      destinationName: data.destinationName,
      destinationAddress: data.destinationAddress ?? null,
      destinationLat: data.destinationLat,
      destinationLng: data.destinationLng,

      members: {
        create: [
          // Creator is automatically an accepted member
          {
            userId,
            status: "ACCEPTED",
            originName: data.originName ?? null,
            originAddress: data.originAddress ?? null,
            originLat: data.originLat,
            originLng: data.originLng,
            joinedAt: new Date()
          },

          // Other users receive invitations
          ...invitedUserIds.map((invitedUserId) => ({
            userId: invitedUserId,
            invitedById: userId,
            status: "INVITED"
          }))
        ]
      }
    },
    include: journeyInclude
  });

  return journey;
};

// ========================================
// GET MY JOURNEYS
// ========================================

export const getMyJourneys = async (userId) => {
  return prisma.journey.findMany({
    where: {
      members: {
        some: {
          userId
        }
      }
    },
    include: journeyInclude,
    orderBy: {
      updatedAt: "desc"
    }
  });
};

// ========================================
// GET JOURNEY DETAILS
// ========================================

export const getJourneyDetails = async (userId, journeyId) => {
  const journey = await prisma.journey.findFirst({
    where: {
      id: journeyId,
      members: {
        some: {
          userId
        }
      }
    },
    include: journeyInclude
  });

  if (!journey) {
    throw new Error("Journey not found or you are not a member");
  }

  return journey;
};

// ========================================
// ACCEPT / DECLINE JOURNEY INVITATION
// ========================================

export const respondToJourneyInvitation = async (
  userId,
  journeyId,
  responseStatus
) => {
  const journey = await prisma.journey.findUnique({
    where: {
      id: journeyId
    },
    include: {
      members: {
        where: {
          userId
        }
      }
    }
  });

  if (!journey) {
    throw new Error("Journey not found");
  }

  const membership = journey.members[0];

  if (!membership || membership.status !== "INVITED") {
    throw new Error("No pending invitation found for this journey");
  }

  if (!["PLANNED", "ACTIVE"].includes(journey.status)) {
    throw new Error("This journey is no longer accepting responses");
  }

  const now = new Date();

  await prisma.journeyMember.update({
    where: {
      id: membership.id
    },
    data: {
      status: responseStatus,
      joinedAt: responseStatus === "ACCEPTED" ? now : null
    }
  });

  return getJourneyDetails(userId, journeyId);
};

// ========================================
// UPDATE MEMBER STARTING LOCATION
// ========================================

export const updateJourneyOrigin = async (
  userId,
  journeyId,
  originData
) => {
  const journey = await prisma.journey.findUnique({
    where: {
      id: journeyId
    }
  });

  if (!journey) {
    throw new Error("Journey not found");
  }

  if (journey.status !== "PLANNED") {
    throw new Error("Starting location can only be changed before the journey starts");
  }

  const membership = await prisma.journeyMember.findFirst({
    where: {
      journeyId,
      userId,
      status: "ACCEPTED"
    }
  });

  if (!membership) {
    throw new Error("You must accept the journey before updating your starting location");
  }

  await prisma.journeyMember.update({
    where: {
      id: membership.id
    },
    data: {
      originName: originData.originName ?? null,
      originAddress: originData.originAddress ?? null,
      originLat: originData.originLat,
      originLng: originData.originLng
    }
  });

  return getJourneyDetails(userId, journeyId);
};

// ========================================
// START JOURNEY
// ========================================

export const startJourney = async (userId, journeyId) => {
  const journey = await prisma.journey.findUnique({
    where: {
      id: journeyId
    }
  });

  if (!journey) {
    throw new Error("Journey not found");
  }

  if (journey.createdById !== userId) {
    throw new Error("Only the journey creator can start this journey");
  }

  if (journey.status !== "PLANNED") {
    throw new Error("Only planned journeys can be started");
  }

  await prisma.journey.update({
    where: {
      id: journeyId
    },
    data: {
      status: "ACTIVE",
      startedAt: new Date()
    }
  });

  return getJourneyDetails(userId, journeyId);
};

// ========================================
// UPDATE MEMBER LIVE LOCATION
// ========================================

export const updateJourneyMemberLocation = async (
  userId,
  journeyId,
  locationData
) => {
  const journey = await prisma.journey.findUnique({
    where: {
      id: journeyId
    },
    select: {
      id: true,
      status: true
    }
  });

  if (!journey) {
    throw new Error("Journey not found");
  }

  if (journey.status !== "ACTIVE") {
    throw new Error("Location can only be updated during an active journey");
  }

  const membership = await prisma.journeyMember.findFirst({
    where: {
      journeyId,
      userId,
      status: "ACCEPTED"
    }
  });

  if (!membership) {
    throw new Error("You are not an active member of this journey");
  }

  return prisma.journeyMember.update({
    where: {
      id: membership.id
    },
    data: {
      currentLat: locationData.latitude,
      currentLng: locationData.longitude,
      speed: locationData.speed ?? null,
      heading: locationData.heading ?? null,
      accuracy: locationData.accuracy ?? null,
      lastLocationAt: new Date()
    }
  });
};

// ========================================
// MARK MEMBER AS ARRIVED
// ========================================

export const markJourneyMemberArrived = async (userId, journeyId) => {
  const journey = await prisma.journey.findUnique({
    where: {
      id: journeyId
    },
    select: {
      id: true,
      status: true
    }
  });

  if (!journey) {
    throw new Error("Journey not found");
  }

  if (journey.status !== "ACTIVE") {
    throw new Error("Only active journeys can be marked as arrived");
  }

  const membership = await prisma.journeyMember.findFirst({
    where: {
      journeyId,
      userId,
      status: "ACCEPTED"
    }
  });

  if (!membership) {
    throw new Error("You are not an active member of this journey");
  }

  await prisma.journeyMember.update({
    where: {
      id: membership.id
    },
    data: {
      status: "ARRIVED",
      arrivedAt: new Date()
    }
  });

  return getJourneyDetails(userId, journeyId);
};

// ========================================
// LEAVE JOURNEY
// ========================================

export const leaveJourney = async (userId, journeyId) => {
  const journey = await prisma.journey.findUnique({
    where: {
      id: journeyId
    }
  });

  if (!journey) {
    throw new Error("Journey not found");
  }

  if (journey.status !== "ACTIVE" && journey.status !== "PLANNED") {
    throw new Error("You cannot leave this journey");
  }

  const membership = await prisma.journeyMember.findFirst({
    where: {
      journeyId,
      userId,
      status: "ACCEPTED"
    }
  });

  if (!membership) {
    throw new Error("You are not an active member of this journey");
  }

  await prisma.journeyMember.update({
    where: {
      id: membership.id
    },
    data: {
      status: "LEFT",
      leftAt: new Date()
    }
  });

  return getJourneyDetails(userId, journeyId);
};

// ========================================
// COMPLETE JOURNEY
// ========================================

export const completeJourney = async (userId, journeyId) => {
  const journey = await prisma.journey.findUnique({
    where: {
      id: journeyId
    }
  });

  if (!journey) {
    throw new Error("Journey not found");
  }

  if (journey.createdById !== userId) {
    throw new Error("Only the journey creator can complete this journey");
  }

  if (journey.status !== "ACTIVE") {
    throw new Error("Only active journeys can be completed");
  }

  await prisma.journey.update({
    where: {
      id: journeyId
    },
    data: {
      status: "COMPLETED",
      endedAt: new Date()
    }
  });

  return getJourneyDetails(userId, journeyId);
};

// ========================================
// CANCEL JOURNEY
// ========================================

export const cancelJourney = async (userId, journeyId) => {
  const journey = await prisma.journey.findUnique({
    where: {
      id: journeyId
    }
  });

  if (!journey) {
    throw new Error("Journey not found");
  }

  if (journey.createdById !== userId) {
    throw new Error("Only the journey creator can cancel this journey");
  }

  if (!["PLANNED", "ACTIVE"].includes(journey.status)) {
    throw new Error("This journey can no longer be cancelled");
  }

  await prisma.journey.update({
    where: {
      id: journeyId
    },
    data: {
      status: "CANCELLED",
      endedAt: new Date()
    }
  });

  return getJourneyDetails(userId, journeyId);
};
