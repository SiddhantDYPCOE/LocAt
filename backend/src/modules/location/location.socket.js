
import prisma from "../../db.js";

import {
  updateLocationShare,
  stopLocationShare
} from "./location.service.js";

import {
  locationUpdateSchema,
  locationShareIdSchema
} from "./location.validation.js";

// Send acknowledgement safely
const sendAck = (ack, response) => {
  if (typeof ack === "function") {
    ack(response);
  }
};

// Check whether two users are accepted connections
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

// Register location socket events
const registerLocationSocket = (io, socket) => {
  const userId = socket.user.userId;

  // ==========================================
  // JOIN LOCATION ROOM
  // ==========================================

  socket.on("location:join", async (data, ack) => {
    try {
      const validatedId = locationShareIdSchema.safeParse(data);

      if (!validatedId.success) {
        return sendAck(ack, {
          success: false,
          message: "Invalid location share ID"
        });
      }

      const { shareId } = validatedId.data;

      const share = await prisma.locationShare.findFirst({
        where: {
          id: shareId,
          status: "ACTIVE",
          OR: [
            { ownerId: userId },
            {
              recipients: {
                some: { userId }
              }
            }
          ]
        },
        select: {
          id: true,
          ownerId: true,
          expiresAt: true
        }
      });

      if (!share) {
        return sendAck(ack, {
          success: false,
          message: "You are not authorized to access this location"
        });
      }

      // Check expiry
      if (share.expiresAt && share.expiresAt <= new Date()) {
        await prisma.locationShare.update({
          where: { id: shareId },
          data: {
            status: "EXPIRED",
            endedAt: new Date()
          }
        });

        return sendAck(ack, {
          success: false,
          message: "Location sharing has expired"
        });
      }

      // Recheck connection if joining as recipient
      if (share.ownerId !== userId) {
        const connection = await verifyAcceptedConnection(
          share.ownerId,
          userId
        );

        if (!connection) {
          return sendAck(ack, {
            success: false,
            message: "Your connection with the owner is no longer active"
          });
        }
      }

      const room = `location:${shareId}`;

      socket.join(room);

      // Fetch latest location for initial map synchronization
      const latestShare = await prisma.locationShare.findUnique({
        where: { id: shareId },
        select: {
          id: true,
          ownerId: true,
          latitude: true,
          longitude: true,
          speed: true,
          heading: true,
          accuracy: true,
          lastUpdatedAt: true,
          startedAt: true,
          expiresAt: true,
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

      return sendAck(ack, {
        success: true,
        message: "Joined location room successfully",
        data: latestShare
      });

    } catch (error) {
      console.error("Location join error:", error);

      return sendAck(ack, {
        success: false,
        message: "Unable to join location room"
      });
    }
  });


  // ==========================================
  // LEAVE LOCATION ROOM
  // ==========================================

  socket.on("location:leave", (data, ack) => {
    try {
      const validatedId = locationShareIdSchema.safeParse(data);

      if (!validatedId.success) {
        return sendAck(ack, {
          success: false,
          message: "Invalid location share ID"
        });
      }

      const room = `location:${validatedId.data.shareId}`;

      socket.leave(room);

      return sendAck(ack, {
        success: true,
        message: "Left location room successfully"
      });

    } catch (error) {
      console.error("Location leave error:", error);

      return sendAck(ack, {
        success: false,
        message: "Unable to leave location room"
      });
    }
  });


  // ==========================================
  // UPDATE LIVE LOCATION
  // ==========================================

  socket.on("location:update", async (data, ack) => {
    try {
      const { shareId, ...locationData } = data || {};

      const validatedId = locationShareIdSchema.safeParse({
        shareId
      });

      const validatedLocation = locationUpdateSchema.safeParse(
        locationData
      );

      if (!validatedId.success || !validatedLocation.success) {
        return sendAck(ack, {
          success: false,
          message: "Invalid location update data"
        });
      }

      const room = `location:${shareId}`;

      // Owner must have joined the room first
      if (!socket.rooms.has(room)) {
        return sendAck(ack, {
          success: false,
          message: "Join the location room before updating"
        });
      }

      // Service verifies that this user owns the active share
      const updatedShare = await updateLocationShare(
        userId,
        shareId,
        validatedLocation.data
      );

      const locationPayload = {
        shareId,
        ownerId: userId,
        latitude: updatedShare.latitude,
        longitude: updatedShare.longitude,
        speed: updatedShare.speed,
        heading: updatedShare.heading,
        accuracy: updatedShare.accuracy,
        lastUpdatedAt: updatedShare.lastUpdatedAt
      };

      // Broadcast to everyone in this location room
      io.to(room).emit("location:updated", locationPayload);

      return sendAck(ack, {
        success: true,
        message: "Location broadcast successfully"
      });

    } catch (error) {
      console.error("Location update error:", error);

      return sendAck(ack, {
        success: false,
        message: error.message || "Unable to update location"
      });
    }
  });


  // ==========================================
  // STOP LOCATION SHARING
  // ==========================================

  socket.on("location:stop", async (data, ack) => {
    try {
      const validatedId = locationShareIdSchema.safeParse(data);

      if (!validatedId.success) {
        return sendAck(ack, {
          success: false,
          message: "Invalid location share ID"
        });
      }

      const { shareId } = validatedId.data;
      const room = `location:${shareId}`;

      if (!socket.rooms.has(room)) {
        return sendAck(ack, {
          success: false,
          message: "Join the location room first"
        });
      }

      // Only the owner can stop sharing
      await stopLocationShare(userId, shareId);

      // Notify all users watching this location
      io.to(room).emit("location:ended", {
        shareId,
        ownerId: userId
      });

      // Remove all connected sockets from this room
      await io.in(room).socketsLeave(room);

      return sendAck(ack, {
        success: true,
        message: "Location sharing stopped successfully"
      });

    } catch (error) {
      console.error("Location stop error:", error);

      return sendAck(ack, {
        success: false,
        message: error.message || "Unable to stop location sharing"
      });
    }
  });
};

export default registerLocationSocket;
