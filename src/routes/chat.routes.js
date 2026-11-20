const express = require("express");
const { listMessages, createMessage } = require("../controllers/chat.controller");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.get("/messages", listMessages);
router.post("/messages", auth(false), createMessage);

module.exports = router;
