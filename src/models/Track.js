const mongoose = require("mongoose");
const toJSON = require("../utils/toJSON");
const { OWNER_TYPES } = require("./Album");

const trackSchema = new mongoose.Schema(
  {
    albumId: { type: mongoose.Schema.Types.ObjectId, ref: "Album", required: true },
    title: { type: String, required: true },
    rawangTitle: { type: String, default: "" },
    artistName: { type: String, required: true },
    albumName: { type: String, required: true },
    ownerType: { type: String, enum: OWNER_TYPES, required: true },
    durationSeconds: { type: Number, required: true },
    audioUrl: { type: String, required: true },
    lyrics: { type: String, default: "" },
    genre: { type: String, default: "" },
    isDownloaded: { type: Boolean, default: false },
    isFavorite: { type: Boolean, default: false },
    playCount: { type: Number, default: 0 },
    hasKaraoke: { type: Boolean, default: false },
    karaokeAudioUrl: { type: String, default: null },
  },
  { timestamps: true }
);

toJSON(trackSchema);

module.exports = mongoose.model("Track", trackSchema);
