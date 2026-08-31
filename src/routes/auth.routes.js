const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/auth.controller");
const { auth } = require("../middleware/auth");

router.post("/register", ctrl.register);
router.post("/login", ctrl.login);
router.post("/refresh", ctrl.refresh);
router.post("/forgot-request", ctrl.forgotRequest);
router.get("/me", auth(true), ctrl.me);
router.post("/change-password", auth(true), ctrl.changePassword);

module.exports = router;
