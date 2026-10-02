const express = require("express");
const { auth } = require("../middleware/auth");
const {
  requestClaim,
  listClaims,
  approveClaim,
  rejectClaim,
} = require("../controllers/ownerClaim.controller");

const router = express.Router();

// Artists request with login; review endpoints stay open like the rest of
// the portal API (trusted internal tool, same as /tracks and /albums).
router.post("/", auth(true), requestClaim);
router.get("/", auth(false), listClaims);
router.post("/:id/approve", approveClaim);
router.post("/:id/reject", rejectClaim);

module.exports = router;
