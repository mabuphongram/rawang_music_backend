const Video = require("../models/Video");

// Accepts a bare 11-char ID or any common YouTube URL form
// (watch?v=, youtu.be/, /shorts/, /embed/, /live/). Returns "" if none.
function extractYoutubeId(input) {
  if (!input) return "";
  const s = String(input).trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(
    /(?:youtube\.com\/(?:watch\?[^#]*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : "";
}

// Accepts seconds number or "m:ss" string. Returns 0 when unparseable.
function parseDuration(v) {
  if (v === undefined || v === null || v === "") return 0;
  if (typeof v === "number") return Math.max(0, Math.floor(v));
  const s = String(v).trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const m = s.match(/^(\d+):([0-5]?\d)$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return 0;
}

function pickPayload(body) {
  const { title, description, order, isPublished, durationSeconds, duration } = body || {};
  const out = {};
  if (title !== undefined) out.title = String(title).trim();
  if (description !== undefined) out.description = String(description);
  if (order !== undefined) out.order = Number(order) || 0;
  if (isPublished !== undefined) out.isPublished = isPublished === true || isPublished === "true";
  if (durationSeconds !== undefined || duration !== undefined) {
    out.durationSeconds = parseDuration(durationSeconds !== undefined ? durationSeconds : duration);
  }
  return out;
}

async function listVideos(req, res) {
  const filter = {};
  if (req.query.isPublished !== undefined) {
    filter.isPublished = req.query.isPublished === "true";
  }
  const videos = await Video.find(filter).sort({ order: 1, createdAt: -1 });
  res.json(videos);
}

async function getVideo(req, res) {
  const video = await Video.findById(req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });
  res.json(video);
}

async function createVideo(req, res) {
  const id = extractYoutubeId((req.body || {}).youtubeVideoId || (req.body || {}).youtubeUrl);
  if (!id) return res.status(400).json({ error: "Valid YouTube link or video ID required" });
  const video = new Video({ ...pickPayload(req.body), youtubeVideoId: id });
  await video.validate();
  await video.save();
  res.status(201).json(video);
}

async function updateVideo(req, res) {
  const video = await Video.findById(req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });
  const body = { ...pickPayload(req.body) };
  if (req.body && (req.body.youtubeVideoId !== undefined || req.body.youtubeUrl !== undefined)) {
    const id = extractYoutubeId(req.body.youtubeVideoId || req.body.youtubeUrl);
    if (!id) return res.status(400).json({ error: "Valid YouTube link or video ID required" });
    body.youtubeVideoId = id;
  }
  video.set(body);
  await video.validate();
  await video.save();
  res.json(video);
}

async function deleteVideo(req, res) {
  const video = await Video.findByIdAndDelete(req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });
  res.status(204).send();
}

module.exports = { listVideos, getVideo, createVideo, updateVideo, deleteVideo, extractYoutubeId };
