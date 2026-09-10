const fs = require("fs/promises");
const Album = require("../models/Album");
const Track = require("../models/Track");
const Contribution = require("../models/Contribution");
const { minioUpload, minioMove, minioRemoveObject } = require("../utils/minioUpload.util");

function sanitizeName(title) {
  return String(title || "untitled")
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/[\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ") || "untitled";
}

// Accept albumIds as array, JSON string (FormData), or legacy single albumId.
function resolveAlbumIds(albumIds, albumId) {
  let ids = albumIds;
  if (typeof ids === "string") {
    try {
      ids = JSON.parse(ids);
    } catch {
      ids = [ids];
    }
  }
  if (Array.isArray(ids) && ids.length > 0) return ids.map(String);
  if (albumId) return [String(albumId)];
  return [];
}

async function discardLocalFiles(files) {
  const all = [...(files?.audio || []), ...(files?.karaoke || [])];
  await Promise.all(all.map((f) => fs.unlink(f.path).catch(() => {})));
}

async function createContribution(req, res) {
  const audioFile = req.files?.audio?.[0];
  const karaokeFile = req.files?.karaoke?.[0];

  if (!audioFile) {
    await discardLocalFiles(req.files);
    return res.status(400).json({ error: "An MP3 audio file is required" });
  }

  const title = (req.body.title || "").trim();
  const artistName = (req.body.artistName || "").trim();
  const composerName = (req.body.composerName || "").trim();
  const durationSeconds = Number(req.body.durationSeconds);

  if (!title || !artistName || !Number.isInteger(durationSeconds) || durationSeconds <= 0) {
    await discardLocalFiles(req.files);
    return res.status(400).json({ error: "title, artistName and durationSeconds (>0) are required" });
  }

  const contribution = new Contribution({
    title,
    artistName,
    composerName,
    durationSeconds,
    audioUrl: "__pending_minio_upload__",
    contributorName: req.user.name,
    contributorUserId: req.user._id,
  });
  await contribution.validate();

  const name = sanitizeName(title);
  contribution.audioUrl = await minioUpload(`pending/${contribution._id}`, audioFile, name);
  if (karaokeFile) {
    contribution.karaokeAudioUrl = await minioUpload(
      `pending/${contribution._id}`,
      karaokeFile,
      `${name}-karaoke`
    );
    contribution.hasKaraoke = true;
  }
  await contribution.save();
  res.status(201).json(contribution);
}

async function listContributions(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const items = await Contribution.find(filter).sort({ createdAt: -1 });
  res.json(items);
}

async function getContribution(req, res) {
  const item = await Contribution.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Contribution not found" });
  res.json(item);
}

// Admin approval: move audio out of quarantine and publish one Track
// into the admin-chosen albums (many-to-many, same as catalogue tracks).
async function approveContribution(req, res) {
  const item = await Contribution.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Contribution not found" });
  if (item.status !== "pending") {
    return res.status(400).json({ error: `Contribution is already ${item.status}` });
  }

  const albumIds = resolveAlbumIds(req.body.albumIds, req.body.albumId);
  if (albumIds.length === 0) {
    return res.status(400).json({ error: "Select at least one album" });
  }
  const firstAlbum = await Album.findById(albumIds[0]);
  if (!firstAlbum) return res.status(400).json({ error: "Primary album not found" });

  const title = (req.body.title || item.title).trim();
  const artistName = (req.body.artistName || item.artistName).trim();
  const composerName = req.body.composerName !== undefined ? String(req.body.composerName).trim() : item.composerName;
  const name = sanitizeName(title);
  const folder = `albums/${albumIds[0]}/tracks`;

  const audioUrl = await minioMove(item.audioUrl, `${folder}/${name}.mp3`);
  let karaokeAudioUrl = null;
  if (item.karaokeAudioUrl) {
    karaokeAudioUrl = await minioMove(item.karaokeAudioUrl, `${folder}/${name}-karaoke.mp3`);
  }

  const track = new Track({
    albumIds,
    albumId: albumIds[0],
    title,
    rawangTitle: "",
    artistName,
    composerName,
    albumName: (req.body.albumName || firstAlbum.title).trim(),
    ownerType: req.body.ownerType || firstAlbum.ownerType,
    durationSeconds: item.durationSeconds,
    audioUrl,
    lyrics: req.body.lyrics !== undefined ? String(req.body.lyrics) : "",
    genre: (req.body.genre || "Cultural").trim(),
    hasKaraoke: Boolean(karaokeAudioUrl),
    karaokeAudioUrl,
  });
  await track.validate();
  await track.save();

  item.status = "approved";
  item.trackId = track._id;
  item.reviewNote = (req.body.reviewNote || "").trim();
  item.reviewedAt = new Date();
  await item.save();

  res.status(201).json({ contribution: item, track });
}

// Admin discard: full cleanup — MinIO quarantine objects + the document.
async function rejectContribution(req, res) {
  const item = await Contribution.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Contribution not found" });
  if (item.status !== "pending") {
    return res.status(400).json({ error: `Contribution is already ${item.status}` });
  }

  await minioRemoveObject(item.audioUrl);
  await minioRemoveObject(item.karaokeAudioUrl);
  await item.deleteOne();
  res.status(204).send();
}

module.exports = {
  createContribution,
  listContributions,
  getContribution,
  approveContribution,
  rejectContribution,
};
