const mongoose = require("mongoose");
const toJSON = require("../utils/toJSON");

const playlistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    createdTimestamp: { type: Number, default: () => Date.now() },
    iconName: { type: String, default: "favorite" },
    trackIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Track" }],
  },
  { timestamps: true }
);

toJSON(playlistSchema);

module.exports = mongoose.model("Playlist", playlistSchema);
