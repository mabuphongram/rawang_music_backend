const express = require("express");
const cors = require("cors");
const path = require("path");

const uploadRoutes = require("./routes/upload.routes");
const albumRoutes = require("./routes/album.routes");
const trackRoutes = require("./routes/track.routes");
const playlistRoutes = require("./routes/playlist.routes");
const chatRoutes = require("./routes/chat.routes");
const singerRoutes = require("./routes/singer.routes");
const organizationRoutes = require("./routes/organization.routes");
const heroSlideRoutes = require("./routes/heroSlide.routes");
const videoRoutes = require("./routes/video.routes");
const contributionRoutes = require("./routes/contribution.routes");
const ownerClaimRoutes = require("./routes/ownerClaim.routes");
const ownerRequestRoutes = require("./routes/ownerRequest.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const presenceRoutes = require("./routes/presence.routes");
const userRoutes = require("./routes/user.routes");
const authRoutes = require("./routes/auth.routes");

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
app.use("/api/auth", authRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/albums", albumRoutes);
app.use("/api/tracks", trackRoutes);
app.use("/api/playlists", playlistRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/singers", singerRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/hero-slides", heroSlideRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/contributions", contributionRoutes);
app.use("/api/owner-claims", ownerClaimRoutes);
app.use("/api/owner-requests", ownerRequestRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/presence", presenceRoutes);
app.use("/api/users", userRoutes);

// Error handler — express 5 forwards rejected async handlers here
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

module.exports = app;
