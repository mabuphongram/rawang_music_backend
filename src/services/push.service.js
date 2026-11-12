const fs = require("fs");
const path = require("path");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

const ALL_USERS_TOPIC = "all_users";
const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 500;

function serviceAccountPath() {
  const configured = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!configured) return null;
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(__dirname, "..", "..", configured);
}

function isPushConfigured() {
  const filePath = serviceAccountPath();
  return Boolean(filePath && fs.existsSync(filePath));
}

function getFirebaseApp() {
  const existingApps = getApps();
  if (existingApps.length > 0) return existingApps[0];

  const filePath = serviceAccountPath();
  if (!filePath) {
    const error = new Error("FIREBASE_SERVICE_ACCOUNT_PATH is not configured");
    error.status = 503;
    throw error;
  }
  if (!fs.existsSync(filePath)) {
    const error = new Error(`Firebase service account file not found: ${filePath}`);
    error.status = 503;
    throw error;
  }

  const serviceAccount = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return initializeApp({
    credential: cert(serviceAccount),
  });
}

function cleanText(value, field, maxLength) {
  const text = String(value || "").trim();
  if (!text) {
    const error = new Error(`${field} is required`);
    error.status = 400;
    throw error;
  }
  if (text.length > maxLength) {
    const error = new Error(`${field} must be ${maxLength} characters or fewer`);
    error.status = 400;
    throw error;
  }
  return text;
}

async function sendBroadcast({ title, body, data }) {
  const cleanTitle = cleanText(title, "Title", MAX_TITLE_LENGTH);
  const cleanBody = cleanText(body, "Body", MAX_BODY_LENGTH);

  const payloadData = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value === undefined || value === null) continue;
    payloadData[key] = String(value);
  }

  const app = getFirebaseApp();

  return getMessaging(app).send({
    topic: ALL_USERS_TOPIC,
    notification: {
      title: cleanTitle,
      body: cleanBody,
    },
    data: payloadData,
    android: {
      priority: "high",
      notification: {
        channelId: "rawang_updates",
        sound: "default",
      },
    },
  });
}

async function sendBroadcastSafely(options) {
  try {
    return await sendBroadcast(options);
  } catch (error) {
    console.warn(`Push notification skipped: ${error.message}`);
    return null;
  }
}

module.exports = {
  ALL_USERS_TOPIC,
  isPushConfigured,
  sendBroadcast,
  sendBroadcastSafely,
};
