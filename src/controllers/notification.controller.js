const {
  ALL_USERS_TOPIC,
  isPushConfigured,
  sendBroadcast,
} = require("../services/push.service");

async function getNotificationStatus(req, res) {
  res.json({
    configured: isPushConfigured(),
    topic: ALL_USERS_TOPIC,
  });
}

async function broadcastNotification(req, res) {
  const { title, body, type, id } = req.body || {};
  const messageId = await sendBroadcast({
    title,
    body,
    data: { type, id },
  });
  res.json({ ok: true, messageId, topic: ALL_USERS_TOPIC });
}

module.exports = { getNotificationStatus, broadcastNotification };
