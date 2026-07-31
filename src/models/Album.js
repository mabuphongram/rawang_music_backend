const mongoose = require("mongoose");
const toJSON = require("../utils/toJSON");

const OWNER_TYPES = ["singer", "organization", "anonymous"];

const albumSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    ownerType: { type: String, enum: OWNER_TYPES, required: true },
    ownerName: { type: String, required: true },
    coverResName: { type: String, default: "" },
    releaseYear: { type: Number, required: true },
    description: { type: String, default: "" },
    trackCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

toJSON(albumSchema);

module.exports = mongoose.model("Album", albumSchema);
module.exports.OWNER_TYPES = OWNER_TYPES;
