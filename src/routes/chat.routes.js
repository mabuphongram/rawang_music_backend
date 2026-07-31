const express = require("express");
const { listMessages, createMessage } = require("../controllers/chat.controller");

const router = express.Router();

router.get("/messages", listMessages);
router.post("/messages", createMessage);

module.exports = router;
