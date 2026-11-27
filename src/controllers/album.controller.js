const Album = require("../models/Album");
const { minioUpload } = require("../utils/minioUpload.util");
const { notifyAlbumCreated } = require("../services/catalogNotifications.service");

async function uploadCoverImage(album, file) {
  if (!file) return;

  album.coverImage = await minioUpload(
    `albums/${album._id}`,
    file,
    "cover"
  );
}

function parseIsPublished(value) {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return Boolean(value);
}

function parseOrder(value) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function albumPayload(body) {
  const payload = { ...(body || {}) };
  const isPublished = parseIsPublished(payload.isPublished);
  const order = parseOrder(payload.order);
  delete payload.isPublished;
  delete payload.order;
  if (isPublished !== undefined) payload.isPublished = isPublished;
  if (order !== undefined) payload.order = order;
  return payload;
}

async function listAlbums(req, res) {
  const filter = {};
  if (req.query.ownerType) filter.ownerType = req.query.ownerType;
  if (req.query.isPublished !== undefined) {
    filter.isPublished = req.query.isPublished === "true";
  }
  const albums = await Album.find(filter).sort({ order: 1, createdAt: 1 });
  res.json(albums);
}

async function getAlbum(req, res) {
  const album = await Album.findById(req.params.id);
  if (!album) return res.status(404).json({ error: "Album not found" });
  res.json(album);
}

async function createAlbum(req, res) {
  const payload = albumPayload(req.body);
  if (payload.order === undefined) {
    const last = await Album.findOne().sort({ order: -1 }).select("order").lean();
    payload.order = Number.isFinite(last?.order) ? last.order + 1 : 0;
  }
  const album = new Album(payload);
  await album.validate();
  await uploadCoverImage(album, req.file);
  await album.save();
  if (album.isPublished) notifyAlbumCreated(album);
  res.status(201).json(album);
}

async function reorderAlbums(req, res) {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
  if (ids.length === 0) {
    return res.status(400).json({ error: "ids array is required" });
  }

  const found = await Album.find({ _id: { $in: ids } }).select("_id").lean();
  if (found.length !== ids.length) {
    return res.status(400).json({ error: "One or more albums were not found" });
  }

  await Album.bulkWrite(
    ids.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order: index } },
      },
    }))
  );

  const albums = await Album.find().sort({ order: 1, createdAt: 1 });
  res.json(albums);
}

async function updateAlbum(req, res) {
  const album = await Album.findById(req.params.id);
  if (!album) return res.status(404).json({ error: "Album not found" });

  album.set(albumPayload(req.body));
  await album.validate();
  await uploadCoverImage(album, req.file);
  await album.save();
  res.json(album);
}

async function deleteAlbum(req, res) {
  const album = await Album.findByIdAndDelete(req.params.id);
  if (!album) return res.status(404).json({ error: "Album not found" });
  res.status(204).send();
}

module.exports = {
  listAlbums,
  getAlbum,
  createAlbum,
  reorderAlbums,
  updateAlbum,
  deleteAlbum,
};
