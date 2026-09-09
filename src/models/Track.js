const mongoose = require("mongoose");
const toJSON = require("../utils/toJSON");
const { OWNER_TYPES } = require("./Album");

const trackSchema = new mongoose.Schema(
  {
    // A song can belong to multiple albums (many-to-many).
    albumIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Album" }],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "A track must belong to at least one album",
      },
    },
    // Legacy single-album reference — auto-mirrored from albumIds[0].
    // Kept as a real field so old documents, old clients, and
    // ?albumId= filters keep working during and after migration.
    albumId: { type: mongoose.Schema.Types.ObjectId, ref: "Album", required: false },
    title: { type: String, required: true },
    rawangTitle: { type: String, default: "" },
    artistName: { type: String, required: true },
    composerName: { type: String, default: "" },
    albumName: { type: String, required: true },
    ownerType: { type: String, enum: OWNER_TYPES, required: true },
    durationSeconds: { type: Number, required: true },
    audioUrl: { type: String, required: true },
    lyrics: { type: String, default: "" },
    genre: { type: String, default: "" },
    playCount: { type: Number, default: 0 },
    hasKaraoke: { type: Boolean, default: false },
    karaokeAudioUrl: { type: String, default: null },
  },
  { timestamps: true }
);

toJSON(trackSchema);

module.exports = mongoose.model("Track", trackSchema);
