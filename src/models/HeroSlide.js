const mongoose = require("mongoose");
const toJSON = require("../utils/toJSON");

const heroSlideSchema = new mongoose.Schema(
  {
    eyebrow: { type: String, default: "" },
    title: { type: String, required: true },
    subtitle: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    durationSeconds: { type: Number, default: 6, min: 3, max: 60 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

toJSON(heroSlideSchema);

module.exports = mongoose.model("HeroSlide", heroSlideSchema);
