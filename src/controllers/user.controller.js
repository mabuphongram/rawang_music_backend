const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { SUBSCRIPTION_PLANS, USER_ROLES } = require("../models/User");
const { TRIAL_YEARS } = require("../config/business");

function safe(user) {
  // toJSON applies the schema transform (string id, drops _id/__v).
  const json = user.toJSON();
  delete json.passwordHash;
  return json;
}

// Minimal public lookup for the trusted internal portals
// (claimant names, payout identity). Never exposes passwordHash.
async function getUserById(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(safe(user));
}

async function listUsers(req, res) {
  const filter = {};
  if (req.query.search) {
    const term = String(req.query.search).trim();
    filter.$or = [
      { phone: { $regex: term, $options: "i" } },
      { name: { $regex: term, $options: "i" } },
      { email: { $regex: term, $options: "i" } },
    ];
  }
  const users = await User.find(filter).sort({ createdAt: -1 });
  res.json(users.map(safe));
}

// Manual subscription activation after offline (bank transfer) payment.
// Paid plans extend from current expiry (or now if expired); free resets
// the trial window. Records amount for artist revenue-share reports.
async function updateSubscription(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { plan, amount } = req.body || {};
  if (!SUBSCRIPTION_PLANS.includes(plan)) {
    return res.status(400).json({ error: "Invalid plan" });
  }
  const now = new Date();
  const current = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : now;
  const base = current > now ? current : now;
  const DAY = 86400000;
  let expires;
  if (plan === "free") expires = new Date(now.getTime() + TRIAL_YEARS * 365 * DAY);
  else if (plan === "one_month") expires = new Date(base.getTime() + 30 * DAY);
  else if (plan === "three_months") expires = new Date(base.getTime() + 90 * DAY);
  else expires = new Date(base.getTime() + 365 * DAY);

  user.subscriptionPlan = plan;
  user.subscriptionStatus = "active";
  user.subscriptionExpiresAt = expires;
  user.subscriptionStartedAt = now;
  user.lastPaymentAt = now;
  user.lastPaymentAmount = amount ?? null;
  await user.save();
  res.json(safe(user));
}

async function resetPassword(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const tempPassword = String(Math.floor(100000 + Math.random() * 900000));
  user.passwordHash = await bcrypt.hash(tempPassword, 10);
  user.mustChangePassword = true;
  // Admin reset kicks every session (e.g. compromised account recovery).
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  res.json({ message: "Password reset to temp, user must change on next login", tempPassword });
}

async function deleteUser(req, res) {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.status(204).send();
}

// Admin edit: name, phone, email, avatarUrl, role. Subscription changes
// stay on the dedicated subscription endpoint.
async function updateUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const { name, phone, email, avatarUrl, role } = req.body || {};

  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ error: "Name cannot be empty" });
    user.name = String(name).trim();
  }
  if (phone !== undefined) {
    const clean = String(phone).trim();
    if (!/^[0-9+\-\s()]{7,20}$/.test(clean)) {
      return res.status(400).json({ error: "Invalid phone format" });
    }
    const taken = await User.findOne({ phone: clean, _id: { $ne: user._id } });
    if (taken) return res.status(409).json({ error: "Phone already registered" });
    user.phone = clean;
  }
  if (email !== undefined) {
    const clean = String(email).trim().toLowerCase();
    if (clean) {
      if (!/^\S+@\S+\.\S+$/.test(clean)) {
        return res.status(400).json({ error: "Invalid email format" });
      }
      const taken = await User.findOne({ email: clean, _id: { $ne: user._id } });
      if (taken) return res.status(409).json({ error: "Email already registered" });
      user.email = clean;
    } else {
      // Unset (not null) so the sparse unique index keeps ignoring it.
      user.email = undefined;
      user.markModified("email");
    }
  }
  if (avatarUrl !== undefined) user.avatarUrl = String(avatarUrl);
  if (role !== undefined) {
    if (!USER_ROLES.includes(role)) return res.status(400).json({ error: "Invalid role" });
    user.role = role;
  }

  await user.save();
  res.json(safe(user));
}

module.exports = { getUserById, listUsers, updateUser, updateSubscription, resetPassword, deleteUser };
