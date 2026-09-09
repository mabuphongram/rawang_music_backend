const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

// Load the backend's configuration regardless of the directory from which the
// process was started. Values provided by Docker/the host still take priority.
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  
  const server = http.createServer(app);
  
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Make io accessible in controllers
  app.set("io", io);

  // ── Online presence tracking ─────────────────────────────────────────
  const onlineSockets = new Set();

  function broadcastOnlineCount() {
    io.emit("online_count", onlineSockets.size);
  }

  io.on("connection", (socket) => {
    onlineSockets.add(socket.id);
    console.log(`Socket connected: ${socket.id} (online: ${onlineSockets.size})`);
    socket.join("rawang-community-chat");
    broadcastOnlineCount();

    socket.on("disconnect", () => {
      onlineSockets.delete(socket.id);
      console.log(`Socket disconnected: ${socket.id} (online: ${onlineSockets.size})`);
      broadcastOnlineCount();
    });
  });

  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

start();
