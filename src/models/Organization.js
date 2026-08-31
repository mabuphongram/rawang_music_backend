const mongoose = require("mongoose");
const toJSON = require("../utils/toJSON");

const organizationSchema = new mongoose.Schema(
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

organizationSchema.virtual("albumCount").get(function () {
  return this._albumCount ?? 0;
});
organizationSchema.virtual("trackCount").get(function () {
  return this._trackCount ?? 0;
});

toJSON(organizationSchema);

module.exports = mongoose.model("Organization", organizationSchema);
