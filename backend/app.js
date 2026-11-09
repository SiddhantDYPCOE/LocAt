
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./src/modules/auth/auth.routes.js";
import connectionRoutes from "./src/modules/connections/connection.routes.js";
import chatRoutes from "./src/modules/chat/chat.routes.js";

const app = express();

// ========================================
// MIDDLEWARES
// ========================================

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ========================================
// HEALTH CHECK
// ========================================

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "LocAt API is running"
  });
});

// ========================================
// API ROUTES
// ========================================

app.use("/api/auth", authRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/chat", chatRoutes);

// ========================================
// 404 HANDLER
// ========================================

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

// ========================================
// GLOBAL ERROR HANDLER
// ========================================

app.use((error, req, res, next) => {
  console.error("API Error:", error);

  return res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});

export default app;
