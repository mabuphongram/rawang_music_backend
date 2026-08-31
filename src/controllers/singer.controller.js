const Singer = require("../models/Singer");
const Album = require("../models/Album");
const Track = require("../models/Track");
const { minioUpload } = require("../utils/minioUpload.util");

function parseSocialLinks(body) {
  let socialLinks = {};
  // Accept JSON string, object, or flat fields
  if (body.socialLinks) {
    if (typeof body.socialLinks === "string") {
      try { socialLinks = JSON.parse(body.socialLinks); } catch { socialLinks = {}; }
    } else if (typeof body.socialLinks === "object") {
      socialLinks = body.socialLinks;
    }
  }
  // Flat keys fallback (FormData / JSON)
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
  const objectName = await minioUpload("singer", file);
  return { ...sanitized, avatarUrl: objectName };
}

// Attach albumCount / trackCount based on ownerName (and ownerId if linked)
async function attachStats(docs) {
  const isArray = Array.isArray(docs);
  const list = isArray ? docs : [docs];
  if (list.length === 0) return docs;

  const names = list.map((d) => d.name);
  // Group albums by ownerName where ownerType singer
  const albumGroups = await Album.aggregate([
    { $match: { ownerType: "singer", ownerName: { $in: names } } },
    { $group: { _id: "$ownerName", count: { $sum: 1 } } },
  ]);
  const trackGroups = await Track.aggregate([
    { $match: { ownerType: "singer", artistName: { $in: names } } },
    // fallback: also match by ownerName if artistName differs — use ownerName field if you store it
    { $group: { _id: "$artistName", count: { $sum: 1 } } },
  ]);

  const albumMap = new Map(albumGroups.map((g) => [g._id, g.count]));
  const trackMap = new Map(trackGroups.map((g) => [g._id, g.count]));

  // Also count tracks via album -> track join for accuracy: count tracks where album's ownerName matches
  // If your tracks' artistName !== singer name, prefer album-based counting
  const albumIdsByOwner = await Album.find({ ownerType: "singer", ownerName: { $in: names } }).select("_id ownerName");
  const ownerByAlbumId = new Map(albumIdsByOwner.map((a) => [String(a._id), a.ownerName]));
  if (ownerByAlbumId.size > 0) {
    const trackByAlbum = await Track.aggregate([
      { $match: { albumId: { $in: albumIdsByOwner.map((a) => a._id) } } },
      { $group: { _id: "$albumId", count: { $sum: 1 } } },
    ]);
    // merge album-based track counts per owner
    const trackCountByOwner = new Map();
    for (const g of trackByAlbum) {
      const owner = ownerByAlbumId.get(String(g._id));
      if (owner) trackCountByOwner.set(owner, (trackCountByOwner.get(owner) || 0) + g.count);
    }
    // prefer album-based counts when available (more reliable than artistName)
    for (const doc of list) {
      const byAlbum = trackCountByOwner.get(doc.name);
      if (byAlbum != null) trackMap.set(doc.name, byAlbum);
    }
  }

  for (const doc of list) {
    const obj = doc.toObject ? doc.toObject() : doc;
    obj.albumCount = albumMap.get(doc.name) || 0;
    obj.trackCount = trackMap.get(doc.name) || 0;
    // replace in place if mongoose doc
    if (doc.toObject) {
      doc._doc.albumCount = obj.albumCount;
      doc._doc.trackCount = obj.trackCount;
    } else {
      doc.albumCount = obj.albumCount;
      doc.trackCount = obj.trackCount;
    }
  }
  return docs;
}

async function listSingers(req, res) {
  const singers = await Singer.find().sort({ createdAt: -1 });
  await attachStats(singers);
  res.json(singers);
}

async function getSinger(req, res) {
  const singer = await Singer.findById(req.params.id);
  if (!singer) return res.status(404).json({ error: "Singer not found" });
  await attachStats(singer);
  res.json(singer);
}

async function createSinger(req, res) {
  const payload = await withAvatar(req.body, req.file);
  const singer = await Singer.create(payload);
  await attachStats(singer);
  res.status(201).json(singer);
}

async function updateSinger(req, res) {
  const payload = await withAvatar(req.body, req.file);
  const singer = await Singer.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true,
  });
  if (!singer) return res.status(404).json({ error: "Singer not found" });
  await attachStats(singer);
  res.json(singer);
}

async function deleteSinger(req, res) {
  const singer = await Singer.findByIdAndDelete(req.params.id);
  if (!singer) return res.status(404).json({ error: "Singer not found" });
  res.status(204).send();
}

module.exports = { listSingers, getSinger, createSinger, updateSinger, deleteSinger };
