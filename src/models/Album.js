const mongoose = require("mongoose");
const toJSON = require("../utils/toJSON");

const OWNER_TYPES = ["singer", "organization", "anonymous"];

const albumSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    ownerType: { type: String, enum: OWNER_TYPES, required: true },
    ownerName: { type: String, required: true },
    ownerModel: { type: String, enum: ["Singer", "Organization"], required: false },
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: false, refPath: "ownerModel" },
    coverResName: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    releaseYear: { type: Number, required: true },
    description: { type: String, default: "" },
    isPremium: { type: Boolean, default: false },
    // One-time price in MMK. Ignored for free albums.
    price: { type: Number, default: 0, min: 0 },
    trackCount: { type: Number, default: 0 },
    // Lower numbers appear first in the admin portal and the Android app.
    order: { type: Number, default: 0 },
    // Unpublished albums stay in the admin catalogue but are hidden from the app.
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

toJSON(albumSchema);

module.exports = mongoose.model("Album", albumSchema);
module.exports.OWNER_TYPES = OWNER_TYPES;
