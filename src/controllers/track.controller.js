const Track = require("../models/Track");
const Album = require("../models/Album");
const Singer = require("../models/Singer");
const Organization = require("../models/Organization");
const PlayEvent = require("../models/PlayEvent");
const { minioUpload } = require("../utils/minioUpload.util");

function trackFileName(title) {
  return String(title || "untitled")
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/[\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ") || "untitled";
}

function getUploadedFile(files, fieldName) {
  return files?.[fieldName]?.[0];
}

function getTrackPayload(body) {
  const { composerName, albumId, albumIds, ...trackFields } = body;
  // Album membership is only touched when the request carries album info —
  // partial updates (e.g. ownership-only) must not wipe it.
  const hasAlbums = albumIds !== undefined || albumId !== undefined;
  const ids = hasAlbums ? resolveAlbumIds(albumIds, albumId) : undefined;

  return {
    ...trackFields,
    ...(composerName !== undefined ? { composerName } : {}),
    ...(hasAlbums
      ? { albumIds: ids, ...(ids.length > 0 ? { albumId: ids[0] } : {}) }
      : {}),
  };
}

// Manual per-track attribution (Ownership tab): exactly one owner per
// track. Explicit ownerId/ownerModel in the body always wins; otherwise
// new tracks mirror the primary album, while updates leave an existing
// attribution untouched (so catalogue edits never wipe manual ownership).
// Detach by sending ownerId: null (track falls back to platform share).
async function applyOwnership(track, body, { onUpdate = false } = {}) {
  const explicit = body.ownerId !== undefined || body.ownerModel !== undefined;
  if (!explicit) {
    if (onUpdate && (track.ownerId || track.ownerModel)) return;
    Object.assign(track, await resolveOwnership(track.albumIds));
    return;
  }
  if (track.ownerId) {
    if (track.ownerModel !== "Singer" && track.ownerModel !== "Organization") {
      const err = new Error("ownerModel must be Singer or Organization when ownerId is set");
      err.status = 400;
      throw err;
    }
    const Model = track.ownerModel === "Singer" ? Singer : Organization;
    const exists = await Model.exists({ _id: track.ownerId });
    if (!exists) {
      const err = new Error("Owner profile not found");
      err.status = 400;
      throw err;
    }
  } else {
    track.ownerModel = null;
  }
}

// Ownership snapshot from the primary album. Anonymous albums yield
// null ownerId — their plays are platform share, never owner earnings.
async function resolveOwnership(albumIds) {
  if (!albumIds || albumIds.length === 0) return {};
  const album = await Album.findById(albumIds[0])
    .select("ownerId ownerModel")
    .lean();
  if (!album) return {};
  return { ownerId: album.ownerId || null, ownerModel: album.ownerModel || null };
}
function resolveAlbumIds(albumIds, albumId) {
  let ids = albumIds;
  if (typeof ids === "string") {
    try {
      ids = JSON.parse(ids);
    } catch {
      ids = [ids];
    }
  }
  if (Array.isArray(ids) && ids.length > 0) {
    return ids.map(String);
  }
  if (albumId) return [String(albumId)];
  return [];
}

async function uploadTrackAudio(track, files) {
  const audioFile = getUploadedFile(files, "audioUrl");
  const karaokeFile = getUploadedFile(files, "karaokeAudioUrl");
  const primaryAlbumId = track.albumIds?.[0];
  const audioFolder = `albums/${primaryAlbumId}/tracks`;
  const name = trackFileName(track.title);

  if (audioFile) {
    track.audioUrl = await minioUpload(audioFolder, audioFile, name);
  }

  if (karaokeFile) {
    track.karaokeAudioUrl = await minioUpload(audioFolder, karaokeFile, `${name}-karaoke`);
    track.hasKaraoke = true;
  }
}

async function listTracks(req, res) {
  const filter = {};
  if (req.query.albumId) {
    // Match both new (albumIds[]) and legacy (albumId) shapes so the
    // filter works whether or not the startup migration has backfilled.
    filter.$or = [{ albumIds: req.query.albumId }, { albumId: req.query.albumId }];
  }
  if (req.query.ownerId) filter.ownerId = req.query.ownerId;
  const tracks = await Track.find(filter).sort({ createdAt: 1 });
  res.json(tracks);
}

async function getTrack(req, res) {
  const track = await Track.findById(req.params.id);
  if (!track) return res.status(404).json({ error: "Track not found" });
  res.json(track);
}

async function createTrack(req, res) {
  const track = new Track(getTrackPayload(req.body));
  const audioFile = getUploadedFile(req.files, "audioUrl");
  // A file will replace this placeholder before the document is saved.
  if (audioFile && !track.audioUrl) track.audioUrl = "__pending_minio_upload__";

  if (!track.albumIds || track.albumIds.length === 0) {
    return res.status(400).json({ error: "A track must belong to at least one album" });
  }
  await applyOwnership(track, req.body);

  await track.validate();
  await uploadTrackAudio(track, req.files);
  await track.save();
  res.status(201).json(track);
}

async function updateTrack(req, res) {
  const track = await Track.findById(req.params.id);
  if (!track) return res.status(404).json({ error: "Track not found" });

  track.set(getTrackPayload(req.body));
  // Self-heal legacy docs that carry albumId but an empty albumIds array.
  if ((!track.albumIds || track.albumIds.length === 0) && track.albumId) {
    track.albumIds = [track.albumId];
  }
  if (!track.albumIds || track.albumIds.length === 0) {
    return res.status(400).json({ error: "A track must belong to at least one album" });
  }
  await applyOwnership(track, req.body, { onUpdate: true });
  await track.validate();
  await uploadTrackAudio(track, req.files);
  await track.save();
  res.json(track);
}

async function deleteTrack(req, res) {
  const track = await Track.findByIdAndDelete(req.params.id);
  if (!track) return res.status(404).json({ error: "Track not found" });
  res.status(204).send();
}

async function incrementPlayCount(req, res) {
  const track = await Track.findByIdAndUpdate(
    req.params.id,
    { $inc: { playCount: 1 } },
    { new: true }
  );
  if (!track) return res.status(404).json({ error: "Track not found" });

  // Verified play: ACTIVE subscribers earn owners money, max one
  // counted event per user/track/day. Guests and expired accounts
  // only move the raw popularity counter — free riders never dilute
  // the royalty pool.
  let counted = false;
  if (req.user && req.isSubscriptionActive) {
    const day = new Date().toISOString().slice(0, 10);
    try {
      await PlayEvent.create({
        userId: req.user._id,
        trackId: track._id,
        ownerId: track.ownerId || null,
        ownerType: track.ownerType,
        ownerModel: track.ownerModel || undefined,
        day,
      });
      counted = true;
    } catch (err) {
      if (err.code !== 11000) throw err; // duplicate = already counted today
    }
  }
  res.json({ playCount: track.playCount, counted });
}

async function getPopularTracks(req, res) {
  const tracks = await Track.find().sort({ playCount: -1 }).limit(10);
  res.json(tracks);
}

module.exports = {
  listTracks,
  getTrack,
  createTrack,
  updateTrack,
  deleteTrack,
  incrementPlayCount,
  getPopularTracks,
};
