const mongoose = require("mongoose");
const toJSON = require("../utils/toJSON");

const ALBUM_PURCHASE_STATUS = ["pending", "approved", "rejected"];

// One-time payment proof for a permanent premium-album entitlement.
// Album title/amount are snapshotted so history stays readable if the
// album is renamed or its price changes later.
const albumPurchaseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    albumId: { type: mongoose.Schema.Types.ObjectId, ref: "Album", required: true, index: true },
    albumTitle: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    buyerName: { type: String, default: "" },
    buyerPhone: { type: String, default: "" },
    buyerEmail: { type: String, default: "" },
    screenshotUrl: { type: String, required: true },
    status: {
      type: String,
      enum: ALBUM_PURCHASE_STATUS,
      default: "pending",
      index: true,
    },
    reviewNote: { type: String, default: "" },
    reviewedAt: { type: Date, required: false },
    reviewedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

albumPurchaseSchema.index({ userId: 1, albumId: 1, createdAt: -1 });
albumPurchaseSchema.index(
  { userId: 1, albumId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
    name: "uniq_pending_album_purchase",
  }
);

toJSON(albumPurchaseSchema);

module.exports = mongoose.model("AlbumPurchase", albumPurchaseSchema);
module.exports.ALBUM_PURCHASE_STATUS = ALBUM_PURCHASE_STATUS;
