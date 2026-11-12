const express = require("express");
const {
  getNotificationStatus,
  broadcastNotification,
} = require("../controllers/notification.controller");

const router = express.Router();

function requirePushKey(req, res, next) {
  const configuredKey = process.env.PUSH_ADMIN_KEY;
  if (!configuredKey) return next();

  const providedKey = req.headers["x-push-key"];
  if (providedKey !== configuredKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

router.get("/status", getNotificationStatus);
router.post("/broadcast", requirePushKey, broadcastNotification);

module.exports = router;
