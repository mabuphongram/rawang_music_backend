const mongoose = require("mongoose");
const toJSON = require("../utils/toJSON");

const USER_ROLES = ["user", "artist", "admin"];
const SUBSCRIPTION_PLANS = ["free", "one_month", "three_months", "one_year"];
const SUBSCRIPTION_STATUS = ["active", "expired", "pending"];

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^[0-9+\-\s()]{7,20}$/, "Invalid phone format"],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      default: null,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    name: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: "" },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: "user" },
    subscriptionPlan: { type: String, enum: SUBSCRIPTION_PLANS, default: "free" },
    subscriptionStatus: { type: String, enum: SUBSCRIPTION_STATUS, default: "active" },
    subscriptionExpiresAt: {
      type: Date,
      // Free tier 3-4 years: default 4 years from creation
      default: () => new Date(Date.now() + 4 * 365 * 24 * 60 * 60 * 1000),
    },
    subscriptionStartedAt: { type: Date, default: Date.now },
    // manual payment tracking
    lastPaymentAt: { type: Date, default: null },
    lastPaymentAmount: { type: Number, default: null },
    mustChangePassword: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// sparse unique for email only when present
userSchema.index({ email: 1 }, { unique: true, sparse: true });

toJSON(userSchema);

// hide passwordHash on toJSON even if selected
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
module.exports.USER_ROLES = USER_ROLES;
module.exports.SUBSCRIPTION_PLANS = SUBSCRIPTION_PLANS;
module.exports.SUBSCRIPTION_STATUS = SUBSCRIPTION_STATUS;
