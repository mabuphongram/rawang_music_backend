const mongoose = require("mongoose");
const toJSON = require("../utils/toJSON");

const singerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    avatarUrl: { type: String, default: "" },
    description: { type: String, default: "" },
    phone: { type: String, default: "" },
    socialLinks: {
      youtube: { type: String, default: "" },
      facebook: { type: String, default: "" },
      tiktok: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

// Virtuals for stats — not stored, computed via aggregation in controller
singerSchema.virtual("albumCount").get(function () {
  return this._albumCount ?? 0;
});
singerSchema.virtual("trackCount").get(function () {
  return this._trackCount ?? 0;
});

toJSON(singerSchema);

module.exports = mongoose.model("Singer", singerSchema);
