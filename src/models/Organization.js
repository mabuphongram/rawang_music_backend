const mongoose = require("mongoose");
const toJSON = require("../utils/toJSON");

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    avatarUrl: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

toJSON(organizationSchema);

module.exports = mongoose.model("Organization", organizationSchema);
