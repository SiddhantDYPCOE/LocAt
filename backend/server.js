
import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app.js";

const PORT = process.env.PORT || 5000;

// Create HTTP server using Express
const server = http.createServer(app);

// Start server
server.listen(PORT, () => {
  console.log(`LocAt server running on port ${PORT}`);
});
