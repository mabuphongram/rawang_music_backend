const mongoose = require("mongoose");
const toJSON = require("../utils/toJSON");

// Community song submission quarantined for admin review.
// Audio lives under the MinIO `pending/` prefix until approval moves it
// into the structured albums/<id>/tracks/ layout. Pending rows are never
// read by the app catalogue sync — only approved Tracks are.
const contributionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    artistName: { type: String, required: true },
    composerName: { type: String, default: "" },
    durationSeconds: { type: Number, required: true, min: 1 },
    audioUrl: { type: String, required: true },
    karaokeAudioUrl: { type: String, default: null },
    hasKaraoke: { type: Boolean, default: false },
    contributorName: { type: String, required: true },
    contributorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    trackId: { type: mongoose.Schema.Types.ObjectId, ref: "Track", required: false },
    reviewNote: { type: String, default: "" },
    reviewedAt: { type: Date, required: false },
  },
  { timestamps: true }
);

toJSON(contributionSchema);

module.exports = mongoose.model("Contribution", contributionSchema);
