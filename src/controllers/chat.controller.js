const ChatMessage = require("../models/ChatMessage");

async function listMessages(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const before = req.query.before;

    let query = {};
    if (before) {
      query.timestamp = { $lt: parseInt(before) };
    }

    const messages = await ChatMessage.find(query)
      .sort({ timestamp: -1 })
      .limit(limit);

    // Reverse to chronological order for the client
    res.json(messages.reverse());
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
}

async function createMessage(req, res) {
  try {
    const { senderName, message, isUser } = req.body;
    const newMessage = await ChatMessage.create({ senderName, message, isUser });
    
    // Broadcast to connected clients
    const io = req.app.get("io");
    if (io) {
      io.to("rawang-community-chat").emit("new_message", newMessage);
    }
    
    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error creating message:", error);
    res.status(500).json({ error: "Failed to create message" });
  }
}

module.exports = { listMessages, createMessage };
