
import dotenv from "dotenv";
dotenv.config();

import https from "https";
import fs from "fs";
import path from "path";

import app from "./app.js";
import initializeSocket from "./src/socket/socket.js";

const PORT = process.env.PORT || 5000;

const sslOptions = {
  key: fs.readFileSync(
    path.resolve("certs/key.pem")
  ),
  cert: fs.readFileSync(
    path.resolve("certs/cert.pem")
  )
};

const server = https.createServer(sslOptions, app);

const io = initializeSocket(server);

app.set("io", io);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`LocAt HTTPS running on port ${PORT}`);
  console.log(`https://192.168.1.22:${PORT}`);
});

export { io };
