const ChatMessage = require("../models/ChatMessage");

async function listMessages(req, res) {
  const messages = await ChatMessage.find().sort({ timestamp: 1 });
  res.json(messages);
}

async function createMessage(req, res) {
  const message = await ChatMessage.create(req.body);
  res.status(201).json(message);
}

module.exports = { listMessages, createMessage };
