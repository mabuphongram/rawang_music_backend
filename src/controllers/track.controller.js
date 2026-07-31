const Track = require("../models/Track");

async function listTracks(req, res) {
  const filter = {};
  if (req.query.albumId) filter.albumId = req.query.albumId;
  if (req.query.downloaded === "true") filter.isDownloaded = true;
  if (req.query.favorite === "true") filter.isFavorite = true;
  const tracks = await Track.find(filter).sort({ createdAt: 1 });
  res.json(tracks);
}

async function getTrack(req, res) {
  const track = await Track.findById(req.params.id);
  if (!track) return res.status(404).json({ error: "Track not found" });
  res.json(track);
}

async function createTrack(req, res) {
  const track = await Track.create(req.body);
  res.status(201).json(track);
}

async function updateTrack(req, res) {
  const track = await Track.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!track) return res.status(404).json({ error: "Track not found" });
  res.json(track);
}

async function deleteTrack(req, res) {
  const track = await Track.findByIdAndDelete(req.params.id);
  if (!track) return res.status(404).json({ error: "Track not found" });
  res.status(204).send();
}

async function setDownloadStatus(req, res) {
  const track = await Track.findByIdAndUpdate(
    req.params.id,
    { isDownloaded: !!req.body.isDownloaded },
    { new: true }
  );
  if (!track) return res.status(404).json({ error: "Track not found" });
  res.json(track);
}

async function setFavoriteStatus(req, res) {
  const track = await Track.findByIdAndUpdate(
    req.params.id,
    { isFavorite: !!req.body.isFavorite },
    { new: true }
  );
  if (!track) return res.status(404).json({ error: "Track not found" });
  res.json(track);
}

module.exports = {
  listTracks,
  getTrack,
  createTrack,
  updateTrack,
  deleteTrack,
  setDownloadStatus,
  setFavoriteStatus,
};
