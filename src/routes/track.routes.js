const express = require("express");
const {
  listTracks,
  getTrack,
  createTrack,
  updateTrack,
  deleteTrack,
  setDownloadStatus,
  setFavoriteStatus,
} = require("../controllers/track.controller");

const router = express.Router();

router.get("/", listTracks);
router.get("/:id", getTrack);
router.post("/", createTrack);
router.put("/:id", updateTrack);
router.delete("/:id", deleteTrack);
router.patch("/:id/download", setDownloadStatus);
router.patch("/:id/favorite", setFavoriteStatus);

module.exports = router;
