const express = require("express");
const cors = require("cors");
const path = require("path");

const uploadRoutes = require("./routes/upload.routes");
const albumRoutes = require("./routes/album.routes");
const trackRoutes = require("./routes/track.routes");
const playlistRoutes = require("./routes/playlist.routes");
const chatRoutes = require("./routes/chat.routes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically (audio/images)
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Routes
app.use("/api/uploads", uploadRoutes);
app.use("/api/albums", albumRoutes);
app.use("/api/tracks", trackRoutes);
app.use("/api/playlists", playlistRoutes);
app.use("/api/chat", chatRoutes);

// Error handler — express 5 forwards rejected async handlers here
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

module.exports = app;
