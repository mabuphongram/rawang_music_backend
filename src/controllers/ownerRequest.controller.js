const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs/promises");
const OwnerRequest = require("../models/OwnerRequest");
const OwnerClaim = require("../models/OwnerClaim");
const Singer = require("../models/Singer");
const Organization = require("../models/Organization");
const User = require("../models/User");
const { minioUpload, minioMove, minioRemoveObject } = require("../utils/minioUpload.util");

const MIN_VIDEO_LINKS = 5;

function profileModel(name) {
  if (name === "Singer") return Singer;
  if (name === "Organization") return Organization;
  return null;
}

// At least 5 links, each a facebook or youtube (watch) URL.
function parseVideoLinks(value) {
  let list = value;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      list = [list];
    }
  }
  if (!Array.isArray(list)) return [];
  const cleaned = [...new Set(list.map((u) => String(u || "").trim()).filter(Boolean))];
  return cleaned.filter((u) => {
    let host = "";
    try {
      host = new URL(u).hostname.toLowerCase();
    } catch {
      return false;
    }
    return (
      host.includes("facebook.com") ||
      host.includes("fb.watch") ||
      host.includes("youtube.com") ||
      host.includes("youtu.be")
    );
  });
}

function randomTempPassword() {
  return crypto.randomBytes(6).toString("base64url").slice(0, 8);
}

async function createRequest(req, res) {
  const avatarFile = req.file;
  const { name, ownerModel, phone, description, requesterName, requesterPhone, videoLinks } = req.body;
  const Model = profileModel(ownerModel);
  if (!Model || !(name || "").trim() || !(requesterName || "").trim() || !(requesterPhone || "").trim()) {
    if (avatarFile) await fs.unlink(avatarFile.path).catch(() => {});
    return res.status(400).json({ error: "name, ownerModel (Singer|Organization), requesterName and requesterPhone are required" });
  }
  if (!avatarFile) {
    return res.status(400).json({ error: "An owner avatar image (JPG/PNG/WEBP) is required" });
  }
  const links = parseVideoLinks(videoLinks);
  if (links.length < MIN_VIDEO_LINKS) {
    await fs.unlink(avatarFile.path).catch(() => {});
    return res.status(400).json({ error: `Attach at least ${MIN_VIDEO_LINKS} facebook or youtube video links (${links.length} valid)` });
  }

  const item = await OwnerRequest.create({
    name: name.trim(),
    ownerModel,
    phone: (phone || "").trim(),
    description: (description || "").trim(),
    requesterName: requesterName.trim(),
    requesterPhone: requesterPhone.trim(),
    videoLinks: links,
    avatarUrl: "__pending_minio_upload__",
  });
  item.avatarUrl = await minioUpload(`pending/${item._id}`, avatarFile, "avatar");
  await item.save();
  res.status(201).json(item);
}

async function listRequests(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const items = await OwnerRequest.find(filter).sort({ createdAt: -1 });
  res.json(items);
}

async function getRequest(req, res) {
  const item = await OwnerRequest.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Request not found" });
  res.json(item);
}

// Admin approval: profile + earnings linkage, plus a login.
// New phone -> artist account with temp password. Already-registered
// phone -> link that login (lift to artist, keep their password) so
// approval never dead-ends on a 409.
async function approveRequest(req, res) {
  const item = await OwnerRequest.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Request not found" });
  if (item.status !== "pending") {
    return res.status(400).json({ error: `Request is already ${item.status}` });
  }
  const Model = profileModel(item.ownerModel);

  const duplicate = await Model.findOne({ name: item.name });
  if (duplicate) {
    return res.status(409).json({
      error: `A ${item.ownerModel} named "${item.name}" already exists — add albums under it or rename this request`,
      profileId: duplicate._id,
    });
  }

  let user;
  let tempPassword = null;
  let linkedExisting = false;
  const taken = await User.findOne({ phone: item.requesterPhone });
  if (taken) {
    user = taken;
    linkedExisting = true;
    if (user.role === "user") {
      user.role = "artist";
      await user.save();
    }
  } else {
    tempPassword = randomTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    user = await User.create({
      phone: item.requesterPhone,
      name: item.requesterName,
      passwordHash,
      role: "artist",
      mustChangePassword: true,
    });
  }

  const profile = await Model.create({
    name: item.name,
    phone: item.phone,
    description: item.description,
    videoLinks: item.videoLinks,
  });

  // Promote the quarantined avatar onto the profile. Old requests without
  // one (or a missing object) must not block approval.
  if (item.avatarUrl && !item.avatarUrl.startsWith("__pending")) {
    try {
      const ext = path.extname(item.avatarUrl).toLowerCase() || ".jpg";
      const dest = `${item.ownerModel.toLowerCase()}/${profile._id}/avatar${ext}`;
      profile.avatarUrl = await minioMove(item.avatarUrl, dest);
      await profile.save();
    } catch (err) {
      console.warn(`Avatar promote skipped for request ${item._id}: ${err.message}`);
    }
  }

  const claim = await OwnerClaim.create({
    ownerModel: item.ownerModel,
    ownerId: profile._id,
    userId: user._id,
    status: "approved",
    reviewNote: "Approved via owner request",
    reviewedAt: new Date(),
  });

  item.status = "approved";
  item.createdUserId = user._id;
  item.createdOwnerId = profile._id;
  item.reviewNote = (req.body?.reviewNote || "").trim();
  item.reviewedAt = new Date();
  await item.save();

  res.status(201).json({
    request: item,
    credentials: tempPassword ? { phone: user.phone, tempPassword } : null,
    linkedExisting,
    profile,
    claim,
  });
}

async function rejectRequest(req, res) {
  const item = await OwnerRequest.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Request not found" });
  if (item.status !== "pending") {
    return res.status(400).json({ error: `Request is already ${item.status}` });
  }
  // Full cleanup: quarantined avatar goes too.
  await minioRemoveObject(item.avatarUrl);
  item.status = "rejected";
  item.reviewNote = (req.body?.reviewNote || "").trim();
  item.reviewedAt = new Date();
  await item.save();
  res.json(item);
}

module.exports = {
  createRequest,
  listRequests,
  getRequest,
  approveRequest,
  rejectRequest,
  MIN_VIDEO_LINKS,
};
