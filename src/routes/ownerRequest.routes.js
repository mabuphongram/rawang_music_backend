const express = require("express");
const { ownerRequestUpload } = require("../middleware/upload");
const {
  createRequest,
  listRequests,
  getRequest,
  approveRequest,
  rejectRequest,
} = require("../controllers/ownerRequest.controller");

const router = express.Router();

// Anyone can request (requesters have no account yet).
// Avatar image rides as multipart field "avatar" into pending/ quarantine.
router.post("/", ownerRequestUpload.single("avatar"), createRequest);
// Review endpoints for the trusted internal portal.
router.get("/", listRequests);
router.get("/:id", getRequest);
router.post("/:id/approve", approveRequest);
router.post("/:id/reject", rejectRequest);

module.exports = router;
