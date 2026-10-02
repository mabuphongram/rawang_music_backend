const mongoose = require("mongoose");
const toJSON = require("../utils/toJSON");

// YouTube-embed videos (MTV). No files on our servers: the player,
// thumbnails and bandwidth all come from YouTube. Deliberately NO
// ownership and NO earnings wiring in V1 (pure editorial content).
const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    youtubeVideoId: {
      type: String,
      required: true,
      trim: true,
      match: [/^[A-Za-z0-9_-]{11}$/, "Invalid YouTube video ID"],
    },
    // Admin-entered (mm:ss or seconds). 0 = unknown, badge hidden.
    durationSeconds: { type: Number, default: 0, min: 0 },
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

toJSON(videoSchema);

module.exports = mongoose.model("Video", videoSchema);
