const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "365d";

function signToken(user, expiresIn = JWT_EXPIRES_IN) {
  return jwt.sign({ id: user._id, phone: user.phone, role: user.role }, JWT_SECRET, { expiresIn });
}

function signRefresh(user) {
  return jwt.sign({ id: user._id, type: "refresh" }, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
}

// POST /api/auth/register
async function register(req, res) {
  const { phone, password, name, email, avatarUrl } = req.body;
  if (!phone || !password || !name) {
    return res.status(400).json({ error: "phone, name, password are required" });
  }
  const cleanPhone = phone.trim();
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  const existing = await User.findOne({ phone: cleanPhone });
  if (existing) return res.status(409).json({ error: "Phone already registered" });
  if (email) {
    const emailExists = await User.findOne({ email: email.trim().toLowerCase() });
    if (emailExists) return res.status(409).json({ error: "Email already registered" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    phone: cleanPhone,
    email: email ? email.trim().toLowerCase() : null,
    name: name.trim(),
    avatarUrl: avatarUrl || "",
    passwordHash,
    // subscription defaults handled by schema (free +4y)
  });
  const token = signToken(user);
  const refreshToken = signRefresh(user);
  const safe = user.toSafeObject();
  res.status(201).json({ user: safe, token, refreshToken });
}

// POST /api/auth/login
async function login(req, res) {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: "phone and password required" });
  const user = await User.findOne({ phone: phone.trim() }).select("+passwordHash");
  if (!user) return res.status(401).json({ error: "Invalid phone or password" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid phone or password" });
  const token = signToken(user);
  const refreshToken = signRefresh(user);
  const safe = user.toSafeObject();
  res.json({ user: safe, token, refreshToken });
}

// GET /api/auth/me
async function me(req, res) {
  const safe = req.user.toSafeObject();
  res.json({ user: safe, isSubscriptionActive: req.isSubscriptionActive });
}

// POST /api/auth/refresh
async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: "refreshToken required" });
  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET);
    if (payload.type !== "refresh") throw new Error("Not a refresh token");
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ error: "User not found" });
    const token = signToken(user);
    const newRefresh = signRefresh(user);
    res.json({ token, refreshToken: newRefresh });
  } catch (err) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
}

// POST /api/auth/forgot-request (manual admin flow)
async function forgotRequest(req, res) {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "phone required" });
  const user = await User.findOne({ phone: phone.trim() });
  if (!user) {
    // do not reveal existence
    return res.json({ message: "If phone exists, admin will contact you. Please call 09xxx." });
  }
  // Mark for admin visibility - set pending status hint
  // In production you could store ResetRequest collection; for now just respond
  res.json({ message: "Request received. Please contact admin via 09xxx / Viber. Admin will reset within 24h." });
}

// POST /api/auth/change-password (protected)
async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: "oldPassword and newPassword required" });
  if (newPassword.length < 6) return res.status(400).json({ error: "New password too short" });
  const user = await User.findById(req.user._id).select("+passwordHash");
  const ok = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Old password incorrect" });
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  await user.save();
  res.json({ message: "Password changed" });
}

module.exports = { register, login, me, refresh, forgotRequest, changePassword };
