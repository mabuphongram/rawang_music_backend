const Playlist = require("../models/Playlist");

async function listPlaylists(req, res) {
  const playlists = await Playlist.find().sort({ createdTimestamp: 1 });
  res.json(playlists);
}

async function getPlaylistTracks(req, res) {
  const playlist = await Playlist.findById(req.params.id).populate("trackIds");
  if (!playlist) return res.status(404).json({ error: "Playlist not found" });
  res.json(playlist.trackIds);
}

async function createPlaylist(req, res) {
  const playlist = await Playlist.create(req.body);
  res.status(201).json(playlist);
}

async function addTrackToPlaylist(req, res) {
  const { trackId } = req.body;
  if (!trackId) return res.status(400).json({ error: "trackId is required" });
  const playlist = await Playlist.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { trackIds: trackId } },
    { new: true }
  ).populate("trackIds");
  if (!playlist) return res.status(404).json({ error: "Playlist not found" });
  res.status(201).json(playlist);
}

async function removeTrackFromPlaylist(req, res) {
  const playlist = await Playlist.findByIdAndUpdate(
    req.params.id,
    { $pull: { trackIds: req.params.trackId } },
    { new: true }
  ).populate("trackIds");
  if (!playlist) return res.status(404).json({ error: "Playlist not found" });
  res.json(playlist);
}

module.exports = {
  listPlaylists,
  getPlaylistTracks,
  createPlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
};
