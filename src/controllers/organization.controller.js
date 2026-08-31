const Organization = require("../models/Organization");
const Album = require("../models/Album");
const Track = require("../models/Track");
const { minioUpload } = require("../utils/minioUpload.util");

function parseSocialLinks(body) {
  let socialLinks = {};
  if (body.socialLinks) {
    if (typeof body.socialLinks === "string") {
      try { socialLinks = JSON.parse(body.socialLinks); } catch { socialLinks = {}; }
    } else if (typeof body.socialLinks === "object") {
      socialLinks = body.socialLinks;
    }
  }
  if (body.youtube) socialLinks.youtube = body.youtube;
  if (body.facebook) socialLinks.facebook = body.facebook;
  if (body.tiktok) socialLinks.tiktok = body.tiktok;
  if (body["socialLinks[youtube]"]) socialLinks.youtube = body["socialLinks[youtube]"];
  if (body["socialLinks[facebook]"]) socialLinks.facebook = body["socialLinks[facebook]"];
  if (body["socialLinks[tiktok]"]) socialLinks.tiktok = body["socialLinks[tiktok]"];

  return {
    youtube: String(socialLinks.youtube || "").trim(),
    facebook: String(socialLinks.facebook || "").trim(),
    tiktok: String(socialLinks.tiktok || "").trim(),
  };
}

function sanitizeBody(body) {
  const { youtube, facebook, tiktok, "socialLinks[youtube]": _a, "socialLinks[facebook]": _b, "socialLinks[tiktok]": _c, socialLinks: _d, ...rest } = body;
  return {
    ...rest,
    phone: body.phone != null ? String(body.phone).trim() : undefined,
    socialLinks: parseSocialLinks(body),
  };
}

async function withAvatar(body, file) {
  const sanitized = sanitizeBody(body);
  if (!file) return sanitized;
  const objectName = await minioUpload("organization", file);
  return { ...sanitized, avatarUrl: objectName };
}

async function attachStats(docs) {
  const isArray = Array.isArray(docs);
  const list = isArray ? docs : [docs];
  if (list.length === 0) return docs;

  const names = list.map((d) => d.name);

  const albumGroups = await Album.aggregate([
    { $match: { ownerType: "organization", ownerName: { $in: names } } },
    { $group: { _id: "$ownerName", count: { $sum: 1 } } },
  ]);
  const albumMap = new Map(albumGroups.map((g) => [g._id, g.count]));

  const albumIdsByOwner = await Album.find({ ownerType: "organization", ownerName: { $in: names } }).select("_id ownerName");
  const ownerByAlbumId = new Map(albumIdsByOwner.map((a) => [String(a._id), a.ownerName]));

  const trackCountByOwner = new Map();
  if (ownerByAlbumId.size > 0) {
    const trackByAlbum = await Track.aggregate([
      { $match: { albumId: { $in: albumIdsByOwner.map((a) => a._id) } } },
      { $group: { _id: "$albumId", count: { $sum: 1 } } },
    ]);
    for (const g of trackByAlbum) {
      const owner = ownerByAlbumId.get(String(g._id));
      if (owner) trackCountByOwner.set(owner, (trackCountByOwner.get(owner) || 0) + g.count);
    }
  }

  for (const doc of list) {
    const albumCount = albumMap.get(doc.name) || 0;
    const trackCount = trackCountByOwner.get(doc.name) || 0;
    if (doc.toObject) {
      doc._doc.albumCount = albumCount;
      doc._doc.trackCount = trackCount;
    } else {
      doc.albumCount = albumCount;
      doc.trackCount = trackCount;
    }
  }
  return docs;
}

async function listOrganizations(req, res) {
  const organizations = await Organization.find().sort({ createdAt: -1 });
  await attachStats(organizations);
  res.json(organizations);
}

async function getOrganization(req, res) {
  const organization = await Organization.findById(req.params.id);
  if (!organization) return res.status(404).json({ error: "Organization not found" });
  await attachStats(organization);
  res.json(organization);
}

async function createOrganization(req, res) {
  const payload = await withAvatar(req.body, req.file);
  const organization = await Organization.create(payload);
  await attachStats(organization);
  res.status(201).json(organization);
}

async function updateOrganization(req, res) {
  const payload = await withAvatar(req.body, req.file);
  const organization = await Organization.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true,
  });
  if (!organization) return res.status(404).json({ error: "Organization not found" });
  await attachStats(organization);
  res.json(organization);
}

async function deleteOrganization(req, res) {
  const organization = await Organization.findByIdAndDelete(req.params.id);
  if (!organization) return res.status(404).json({ error: "Organization not found" });
  res.status(204).send();
}

module.exports = { listOrganizations, getOrganization, createOrganization, updateOrganization, deleteOrganization };
