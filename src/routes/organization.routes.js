const express = require("express");
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
router.post("/", createOrganization);
router.put("/:id", updateOrganization);
router.delete("/:id", deleteOrganization);

module.exports = router;
