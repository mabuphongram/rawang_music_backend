const express = require("express");
const { auth, requireActiveSubscription } = require("../middleware/auth");
const { contributionUpload } = require("../middleware/upload");
const {
  createContribution,
  listContributions,
  getContribution,
  approveContribution,
  rejectContribution,
} = require("../controllers/contribution.controller");

const router = express.Router();

const contributionFiles = contributionUpload.fields([
  { name: "audio", maxCount: 1 },
  { name: "karaoke", maxCount: 1 },
]);

// Login + active subscription required: expired accounts must renew first.
router.post("/", auth(true), requireActiveSubscription, contributionFiles, createContribution);
// Admin portal endpoints (portal is a trusted internal tool, same as /tracks).
router.get("/", listContributions);
router.get("/:id", getContribution);
router.post("/:id/approve", approveContribution);
router.delete("/:id", rejectContribution);

module.exports = router;
