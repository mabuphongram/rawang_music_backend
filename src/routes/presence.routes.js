const express = require("express");
const { getSnapshot, httpCanRead } = require("../realtime/presence");

const router = express.Router();

// Read-only fallback for the admin portal when a WebSocket is unavailable.
// Set PRESENCE_ADMIN_KEY to require the x-presence-key header (or ?key=).
router.get("/", (req, res) => {
  if (!httpCanRead(req)) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  res.set("Cache-Control", "no-store");
  res.json(getSnapshot());
});

module.exports = router;
