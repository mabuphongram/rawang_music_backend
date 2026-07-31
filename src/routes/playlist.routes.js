const express = require("express");
const {
  listPlaylists,
  getPlaylistTracks,
  createPlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
} = require("../controllers/playlist.controller");

const router = express.Router();

router.get("/", listPlaylists);
router.post("/", createPlaylist);
router.get("/:id/tracks", getPlaylistTracks);
router.post("/:id/tracks", addTrackToPlaylist);
router.delete("/:id/tracks/:trackId", removeTrackFromPlaylist);

module.exports = router;
