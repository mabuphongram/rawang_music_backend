const mongoose = require("mongoose");
const toJSON = require("../utils/toJSON");

const chatMessageSchema = new mongoose.Schema(
  {
    senderName: { type: String, required: true },
    message: { type: String, default: "" },
    timestamp: { type: Number, default: () => Date.now() },
    attachedTrackId: { type: mongoose.Schema.Types.ObjectId, ref: "Track", default: null },
    attachedTrackTitle: { type: String, default: null },
    isUser: { type: Boolean, default: false },
  },
  { timestamps: true }
);

toJSON(chatMessageSchema);

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
