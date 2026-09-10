const express = require("express");
const { auth } = require("../middleware/auth");
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

// Login required: contributor identity comes from the JWT, never the client.
router.post("/", auth(true), contributionFiles, createContribution);
// Admin portal endpoints (portal is a trusted internal tool, same as /tracks).
router.get("/", listContributions);
router.get("/:id", getContribution);
router.post("/:id/approve", approveContribution);
router.delete("/:id", rejectContribution);

module.exports = router;
