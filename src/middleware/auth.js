const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET;

function auth(required = true) {
  return async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      if (!required) return next();
      return res.status(401).json({ error: "Missing token" });
    }
    const token = header.split(" ")[1];
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(payload.id);
      if (!user) return res.status(401).json({ error: "User not found" });
      // attach safe user
      req.user = user;
      // subscription gate: if expired, still allow browsing but block write/download
      const isExpired = user.subscriptionStatus === "expired" ||
        (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) < new Date());
      req.isSubscriptionActive = !isExpired && user.subscriptionStatus === "active";
      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token", details: err.message });
    }
  };
}

// strict gate for premium actions
function requireActiveSubscription(req, res, next) {
  if (!req.isSubscriptionActive) {
    return res.status(403).json({ error: "Subscription expired", code: "SUBSCRIPTION_EXPIRED" });
  }
  next();
}

module.exports = { auth, requireActiveSubscription };
