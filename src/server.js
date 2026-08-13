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

  io.on("connection", (socket) => {
    console.log("A user connected to chat socket");
    socket.join("rawang-community-chat");
    
    socket.on("disconnect", () => {
      console.log("User disconnected from chat socket");
    });
  });

  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

start();
