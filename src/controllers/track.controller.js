const Track = require("../models/Track");
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
  const ids = resolveAlbumIds(albumIds, albumId);

  return {
    ...trackFields,
    ...(composerName !== undefined ? { composerName } : {}),
    albumIds: ids,
    // Legacy mirror: primary album is always albumIds[0].
    ...(ids.length > 0 ? { albumId: ids[0] } : {}),
  };
}

// Accept albumIds as array, JSON string (FormData), or fall back to legacy albumId.
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

  await track.validate();
  await uploadTrackAudio(track, req.files);
  await track.save();
  res.status(201).json(track);
}

async function updateTrack(req, res) {
  const track = await Track.findById(req.params.id);
  if (!track) return res.status(404).json({ error: "Track not found" });

  track.set(getTrackPayload(req.body));
  if (!track.albumIds || track.albumIds.length === 0) {
    return res.status(400).json({ error: "A track must belong to at least one album" });
  }
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
  res.json({ playCount: track.playCount });
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
