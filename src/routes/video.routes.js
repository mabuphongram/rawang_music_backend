const express = require("express");
const {
  listVideos,
  getVideo,
  createVideo,
  updateVideo,
  deleteVideo,
} = require("../controllers/video.controller");

const router = express.Router();

// No file uploads: YouTube hosts video + thumbnails, we store only the ID.
router.get("/", listVideos);
router.get("/:id", getVideo);
router.post("/", createVideo);
router.put("/:id", updateVideo);
router.delete("/:id", deleteVideo);

module.exports = router;
