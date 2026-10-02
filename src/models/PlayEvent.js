const mongoose = require("mongoose");
const toJSON = require("../utils/toJSON");

// Verified play for earnings + analytics. One row per user/track/day
// (unique index) — raw popularity still lives on Track.playCount.
// ownerId is null for anonymous tracks: platform (unattributed) share.
const playEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    trackId: { type: mongoose.Schema.Types.ObjectId, ref: "Track", required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: false, default: null },
    ownerType: { type: String, enum: ["singer", "organization", "anonymous"], required: true },
    ownerModel: { type: String, enum: ["Singer", "Organization"], required: false },
    day: { type: String, required: true }, // YYYY-MM-DD (UTC) dedupe bucket
    playedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

playEventSchema.index({ userId: 1, trackId: 1, day: 1 }, { unique: true });
playEventSchema.index({ ownerId: 1, playedAt: -1 });
playEventSchema.index({ playedAt: -1 });

toJSON(playEventSchema);

module.exports = mongoose.model("PlayEvent", playEventSchema);
