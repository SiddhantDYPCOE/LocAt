
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

import registerChatSocket from "../modules/chat/chat.socket.js";

const getCookieToken = (cookieHeader) => {
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("locat_token="));

  return cookie
    ? decodeURIComponent(
        cookie.substring("locat_token=".length)
      )
    : null;
};

const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true
    }
  });

  // Authentication handshake
  io.use((socket, next) => {
    try {
      const authToken = socket.handshake.auth?.token;

      const token = authToken
        ? authToken.startsWith("Bearer ")
          ? authToken.substring(7)
          : authToken
        : getCookieToken(socket.handshake.headers.cookie);

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      socket.user = {
        userId: decoded.userId
      };

      next();
    } catch (error) {
      next(new Error("Invalid or expired authentication token"));
    }
  });

  // Register socket modules after successful connection
  io.on("connection", (socket) => {
    console.log(`LocAt socket connected: ${socket.user.userId}`);

    registerChatSocket(io, socket);

    socket.on("disconnect", (reason) => {
      console.log(
        `LocAt socket disconnected: ${socket.user.userId}`,
        reason
      );
    });
  });

  return io;
};

export default initializeSocket;
