const express = require("express");
const upload = require("../middleware/upload");
const {
  listTracks,
  getTrack,
  createTrack,
  updateTrack,
  deleteTrack,
} = require("../controllers/track.controller");

const router = express.Router();

router.get("/", listTracks);
router.get("/:id", getTrack);
const trackUpload = upload.fields([
  { name: "audioUrl", maxCount: 1 },
  { name: "karaokeAudioUrl", maxCount: 1 },
]);

router.post("/", trackUpload, createTrack);
router.put("/:id", trackUpload, updateTrack);
router.delete("/:id", deleteTrack);

module.exports = router;
