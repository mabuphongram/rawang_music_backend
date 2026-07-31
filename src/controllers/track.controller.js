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

async function uploadTrackAudio(track, files) {
  const audioFile = getUploadedFile(files, "audioUrl");
  const karaokeFile = getUploadedFile(files, "karaokeAudioUrl");
  const audioFolder = `albums/${track.albumId}/tracks`;
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
  if (req.query.albumId) filter.albumId = req.query.albumId;
  const tracks = await Track.find(filter).sort({ createdAt: 1 });
  res.json(tracks);
}

async function getTrack(req, res) {
  const track = await Track.findById(req.params.id);
  if (!track) return res.status(404).json({ error: "Track not found" });
  res.json(track);
}

async function createTrack(req, res) {
  const track = new Track(req.body);
  const audioFile = getUploadedFile(req.files, "audioUrl");

  // A file will replace this placeholder before the document is saved.
  if (audioFile && !track.audioUrl) track.audioUrl = "__pending_minio_upload__";

  await track.validate();
  await uploadTrackAudio(track, req.files);
  await track.save();
  res.status(201).json(track);
}

async function updateTrack(req, res) {
  const track = await Track.findById(req.params.id);
  if (!track) return res.status(404).json({ error: "Track not found" });

  track.set(req.body);
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

module.exports = {
  listTracks,
  getTrack,
  createTrack,
  updateTrack,
  deleteTrack,
};
