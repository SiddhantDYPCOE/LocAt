
// import dotenv from "dotenv";
// dotenv.config();

// import https from "https";
// import fs from "fs";
// import path from "path";

// import app from "./app.js";
// import initializeSocket from "./src/socket/socket.js";

// const PORT = process.env.PORT || 5000;

// const sslOptions = {
//   key: fs.readFileSync(
//     path.resolve("certs/key.pem")
//   ),
//   cert: fs.readFileSync(
//     path.resolve("certs/cert.pem")
//   )
// };

// const server = https.createServer(sslOptions, app);

// const io = initializeSocket(server);

// app.set("io", io);

// server.listen(PORT, "0.0.0.0", () => {
//   console.log(`LocAt HTTPS running on port ${PORT}`);
//   console.log(`https://192.168.1.22:${PORT}`);
// });

// export { io };


import dotenv from "dotenv";
dotenv.config();

import http from "http";

import app from "./app.js";
import initializeSocket from "./src/socket/socket.js";

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);

app.set("io", io);

// Start server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`LocAt server running on port ${PORT}`);
});

export { io };
