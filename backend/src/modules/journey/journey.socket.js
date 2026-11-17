
import prisma from "../../db.js";

import {
  journeyIdSchema,
  journeyLocationUpdateSchema
} from "./journey.validation.js";

const sendAck = (ack, response) => {
  if (typeof ack === "function") {
    ack(response);
  }
};

const registerJourneySocket = (io, socket) => {
  const userId = socket.user.userId;

  // ==========================================
  // JOIN JOURNEY ROOM
  // ==========================================

  socket.on("journey:join", async (data, ack) => {
    try {
      const validated = journeyIdSchema.safeParse(data);

      if (!validated.success) {
        return sendAck(ack, {
          success: false,
          message: "Invalid journey ID"
        });
      }

      const { journeyId } = validated.data;

      const journey = await prisma.journey.findFirst({
        where: {
          id: journeyId,
          status: {
            in: ["PLANNED", "ACTIVE", "COMPLETED"]
          },
          members: {
            some: {
              userId,
              status: {
                in: ["ACCEPTED", "ARRIVED"]
              }
            }
          }
        },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              username: true,
              avatarUrl: true
            }
          },
          members: {
            where: {
              status: {
                in: ["ACCEPTED", "ARRIVED"]
              }
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
            },
            orderBy: {
              invitedAt: "asc"
            }
          }
        }
      });

      if (!journey) {
        return sendAck(ack, {
          success: false,
          message: "Journey not found or you are not an accepted member"
        });
      }

      const room = `journey:${journeyId}`;

      await socket.join(room);

      return sendAck(ack, {
        success: true,
        message: "Joined journey room successfully",
        data: journey
      });
    } catch (error) {
      console.error("Journey join error:", error);

      return sendAck(ack, {
        success: false,
        message: "Unable to join journey room"
      });
    }
  });

  // ==========================================
  // LEAVE JOURNEY ROOM
  // ==========================================

  socket.on("journey:leave", async (data, ack) => {
    try {
      const validated = journeyIdSchema.safeParse(data);

      if (!validated.success) {
        return sendAck(ack, {
          success: false,
          message: "Invalid journey ID"
        });
      }

      const room = `journey:${validated.data.journeyId}`;

      socket.leave(room);

      return sendAck(ack, {
        success: true,
        message: "Left journey room successfully"
      });
    } catch (error) {
      console.error("Journey leave error:", error);

      return sendAck(ack, {
        success: false,
        message: "Unable to leave journey room"
      });
    }
  });

  // ==========================================
  // UPDATE MEMBER LIVE LOCATION
  // ==========================================

  socket.on("journey:location-update", async (data, ack) => {
    try {
      const { journeyId, ...locationData } = data || {};

      const validatedId = journeyIdSchema.safeParse({
        journeyId
      });

      const validatedLocation =
        journeyLocationUpdateSchema.safeParse(locationData);

      if (!validatedId.success || !validatedLocation.success) {
        return sendAck(ack, {
          success: false,
          message: "Invalid journey location data"
        });
      }

      const room = `journey:${journeyId}`;

      if (!socket.rooms.has(room)) {
        return sendAck(ack, {
          success: false,
          message: "Join the journey room before updating location"
        });
      }

      const membership = await prisma.journeyMember.findFirst({
        where: {
          journeyId,
          userId,
          status: "ACCEPTED",
          journey: {
            status: "ACTIVE"
          }
        },
        select: {
          id: true
        }
      });

      if (!membership) {
        return sendAck(ack, {
          success: false,
          message: "You cannot update location for this journey"
        });
      }

      const updatedMember = await prisma.journeyMember.update({
        where: {
          id: membership.id
        },
        data: {
          currentLat: validatedLocation.data.latitude,
          currentLng: validatedLocation.data.longitude,
          speed: validatedLocation.data.speed ?? null,
          heading: validatedLocation.data.heading ?? null,
          accuracy: validatedLocation.data.accuracy ?? null,
          lastLocationAt: new Date()
        },
        select: {
          journeyId: true,
          userId: true,
          currentLat: true,
          currentLng: true,
          speed: true,
          heading: true,
          accuracy: true,
          lastLocationAt: true,
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatarUrl: true
            }
          }
        }
      });

      const locationPayload = {
        ...updatedMember
      };

      io.to(room).emit(
        "journey:member-location",
        locationPayload
      );

      return sendAck(ack, {
        success: true,
        message: "Journey location updated successfully",
        data: locationPayload
      });
    } catch (error) {
      console.error("Journey location update error:", error);

      return sendAck(ack, {
        success: false,
        message: "Unable to update journey location"
      });
    }
  });

  // ==========================================
  // STOP MEMBER LOCATION SHARING
  // ==========================================

  socket.on("journey:location-stop", async (data, ack) => {
    try {
      const validated = journeyIdSchema.safeParse(data);

      if (!validated.success) {
        return sendAck(ack, {
          success: false,
          message: "Invalid journey ID"
        });
      }

      const { journeyId } = validated.data;
      const room = `journey:${journeyId}`;

      if (!socket.rooms.has(room)) {
        return sendAck(ack, {
          success: false,
          message: "Join the journey room before stopping location sharing"
        });
      }

      const membership = await prisma.journeyMember.findFirst({
        where: {
          journeyId,
          userId,
          status: {
            in: ["ACCEPTED", "ARRIVED"]
          },
          journey: {
            status: "ACTIVE"
          }
        },
        select: {
          id: true
        }
      });

      if (!membership) {
        return sendAck(ack, {
          success: false,
          message: "You cannot stop location sharing for this journey"
        });
      }

      await prisma.journeyMember.update({
        where: {
          id: membership.id
        },
        data: {
          currentLat: null,
          currentLng: null,
          speed: null,
          heading: null,
          accuracy: null,
          lastLocationAt: null
        }
      });

      const payload = {
        journeyId,
        userId
      };

      io.to(room).emit(
        "journey:member-location-stopped",
        payload
      );

      return sendAck(ack, {
        success: true,
        message: "Location sharing stopped successfully"
      });
    } catch (error) {
      console.error("Journey location stop error:", error);

      return sendAck(ack, {
        success: false,
        message: "Unable to stop journey location sharing"
      });
    }
  });

  // ==========================================
  // SYNCHRONIZE MEMBER STATUS
  // ==========================================

  socket.on("journey:member-status-sync", async (data, ack) => {
    try {
      const validated = journeyIdSchema.safeParse(data);

      if (!validated.success) {
        return sendAck(ack, {
          success: false,
          message: "Invalid journey ID"
        });
      }

      const { journeyId } = validated.data;
      const room = `journey:${journeyId}`;

      if (!socket.rooms.has(room)) {
        return sendAck(ack, {
          success: false,
          message: "Join the journey room before synchronizing status"
        });
      }

      // Always read the actual status from the database.
      const membership = await prisma.journeyMember.findFirst({
        where: {
          journeyId,
          userId
        },
        select: {
          journeyId: true,
          userId: true,
          status: true,
          joinedAt: true,
          departedAt: true,
          arrivedAt: true,
          leftAt: true,
          journey: {
            select: {
              status: true
            }
          }
        }
      });

      if (!membership) {
        return sendAck(ack, {
          success: false,
          message: "Journey membership not found"
        });
      }

      // Clear stale coordinates when a member arrives or leaves.
      if (
        membership.status === "ARRIVED" ||
        membership.status === "LEFT"
      ) {
        await prisma.journeyMember.update({
          where: {
            journeyId_userId: {
              journeyId,
              userId
            }
          },
          data: {
            currentLat: null,
            currentLng: null,
            speed: null,
            heading: null,
            accuracy: null,
            lastLocationAt: null
          }
        });

        io.to(room).emit(
          "journey:member-location-stopped",
          {
            journeyId,
            userId
          }
        );
      }

      const statusPayload = {
        journeyId,
        userId,
        status: membership.status,
        joinedAt: membership.joinedAt,
        departedAt: membership.departedAt,
        arrivedAt: membership.arrivedAt,
        leftAt: membership.leftAt,
        journeyStatus: membership.journey.status
      };

      io.to(room).emit(
        "journey:member-status-updated",
        statusPayload
      );

      return sendAck(ack, {
        success: true,
        message: "Member status synchronized successfully",
        data: statusPayload
      });
    } catch (error) {
      console.error("Journey member status sync error:", error);

      return sendAck(ack, {
        success: false,
        message: "Unable to synchronize member status"
      });
    }
  });
};

export default registerJourneySocket;
