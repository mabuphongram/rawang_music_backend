const mongoose = require("mongoose");
const toJSON = require("../utils/toJSON");

const singerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    avatarUrl: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

toJSON(singerSchema);

module.exports = mongoose.model("Singer", singerSchema);
