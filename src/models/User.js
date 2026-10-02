const mongoose = require("mongoose");
const toJSON = require("../utils/toJSON");
const { TRIAL_YEARS } = require("../config/business");

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
      // No default: the field must stay ABSENT when unset so the sparse
      // unique index ignores email-less users (stored nulls would collide).
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
      // Free trial from creation (then manual paid plans via admin)
      default: () => new Date(Date.now() + TRIAL_YEARS * 365 * 24 * 60 * 60 * 1000),
    },
    subscriptionStartedAt: { type: Date, default: Date.now },
    // Single-session guard: bumped on every login / password change.
    // Access tokens carry this number; mismatched tokens are rejected.
    tokenVersion: { type: Number, default: 0 },
    lastPaymentAt: { type: Date, default: null },
    lastPaymentAmount: { type: Number, default: null },
    mustChangePassword: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// sparse unique for email only when present (declared inline on the path above)
toJSON(userSchema);

// hide passwordHash on toJSON even if selected
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.tokenVersion;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
module.exports.USER_ROLES = USER_ROLES;
module.exports.SUBSCRIPTION_PLANS = SUBSCRIPTION_PLANS;
module.exports.SUBSCRIPTION_STATUS = SUBSCRIPTION_STATUS;
