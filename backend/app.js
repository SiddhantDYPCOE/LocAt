
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./src/modules/auth/auth.routes.js";
import connectionRoutes from "./src/modules/connections/connection.routes.js";
import chatRoutes from "./src/modules/chat/chat.routes.js";
import locationRoutes from "./src/modules/location/location.routes.js";
import journeyRoutes from "./src/modules/journey/journey.routes.js";

const app = express();

// ========================================
// CORS CONFIGURATION
// ========================================

const allowedOrigins = [
  "http://localhost:5173",
  "https://atposition.vercel.app",
  "https://p-message-socket-f.onrender.com",
  process.env.CLIENT_URL
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an origin (e.g. Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// ========================================
// MIDDLEWARES
// ========================================

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
app.use("/api/location", locationRoutes);
app.use("/api/journeys", journeyRoutes);

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
