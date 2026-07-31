const express = require("express");
const upload = require("../middleware/upload");
const {
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} = require("../controllers/organization.controller");

const router = express.Router();

router.get("/", listOrganizations);
router.get("/:id", getOrganization);
router.post("/", upload.single("avatar"), createOrganization);
router.put("/:id", upload.single("avatar"), updateOrganization);
router.delete("/:id", deleteOrganization);

module.exports = router;
