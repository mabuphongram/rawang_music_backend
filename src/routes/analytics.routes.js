const express = require("express");
const { auth } = require("../middleware/auth");
const {
  ownerSummary,
  ownerDaily,
  ownerTopTracks,
} = require("../controllers/analytics.controller");

const router = express.Router();

// Owner portal endpoints: login required + approved profile claim.
// Query: ?ownerModel=Singer|Organization&ownerId=<id>
router.get("/owner/summary", auth(true), ownerSummary);
router.get("/owner/daily", auth(true), ownerDaily);
router.get("/owner/top-tracks", auth(true), ownerTopTracks);

module.exports = router;
