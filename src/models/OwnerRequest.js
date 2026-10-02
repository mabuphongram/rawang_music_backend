const mongoose = require("mongoose");
const toJSON = require("../utils/toJSON");

// Artist/organization onboarding request submitted from the app.
// Admin reviews, creates the login + profile manually, and hands over
// credentials via a social app. Catalogue entry (albums/tracks) is also
// manual, based on this data.
const ownerRequestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    ownerModel: { type: String, enum: ["Singer", "Organization"], required: true },
    phone: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    requesterName: { type: String, required: true, trim: true },
    requesterPhone: { type: String, required: true, trim: true },
    // Owner avatar quarantined under pending/ until approval moves it
    // onto the created profile.
    avatarUrl: { type: String, default: "" },
    // Proof videos: at least 5 facebook/youtube links (validated in controller).
    videoLinks: { type: [String], required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    createdUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    createdOwnerId: { type: mongoose.Schema.Types.ObjectId, required: false },
    reviewNote: { type: String, default: "" },
    reviewedAt: { type: Date, required: false },
  },
  { timestamps: true }
);

toJSON(ownerRequestSchema);

module.exports = mongoose.model("OwnerRequest", ownerRequestSchema);
