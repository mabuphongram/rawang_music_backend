const express = require("express");
const { getUserById, listUsers, updateUser, updateSubscription, resetPassword, deleteUser } = require("../controllers/user.controller");

const router = express.Router();

// Trusted internal portal endpoints (same as /tracks and /albums).
router.get("/", listUsers);
router.get("/:id", getUserById);
router.put("/:id", updateUser);
router.put("/:id/subscription", updateSubscription);
router.post("/:id/reset-password", resetPassword);
router.delete("/:id", deleteUser);

module.exports = router;
