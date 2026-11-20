const mongoose = require("mongoose");

const trackPlaySchema = new mongoose.Schema(
  {
    trackId: { type: mongoose.Schema.Types.ObjectId, ref: "Track", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    playedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

trackPlaySchema.index({ playedAt: -1 });
trackPlaySchema.index({ trackId: 1, playedAt: -1 });
trackPlaySchema.index({ playedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model("TrackPlay", trackPlaySchema);
