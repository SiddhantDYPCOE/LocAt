
import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app.js";
import initializeSocket from "./src/socket/socket.js";

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);

// Start server
server.listen(PORT, () => {
  console.log(`LocAt server running on port ${PORT}`);
});

export { io };
