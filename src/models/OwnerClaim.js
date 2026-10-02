const mongoose = require("mongoose");
const toJSON = require("../utils/toJSON");

// Links a login (artist user) to a Singer/Organization profile.
// Admin approves; one approved claim per profile. Earnings accrue to the
// profile regardless — approval only unlocks visibility/payouts.
const ownerClaimSchema = new mongoose.Schema(
  {
    ownerModel: { type: String, enum: ["Singer", "Organization"], required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: "ownerModel" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewNote: { type: String, default: "" },
    reviewedAt: { type: Date, required: false },
  },
  { timestamps: true }
);

ownerClaimSchema.index({ ownerModel: 1, ownerId: 1, userId: 1 }, { unique: true });

toJSON(ownerClaimSchema);

module.exports = mongoose.model("OwnerClaim", ownerClaimSchema);
