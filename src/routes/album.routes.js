const express = require("express");
const upload = require("../middleware/upload");
const {
  listAlbums,
  getAlbum,
  createAlbum,
  updateAlbum,
  deleteAlbum,
} = require("../controllers/album.controller");

const router = express.Router();

router.get("/", listAlbums);
router.get("/:id", getAlbum);
router.post("/", upload.single("coverImage"), createAlbum);
router.put("/:id", upload.single("coverImage"), updateAlbum);
router.delete("/:id", deleteAlbum);

module.exports = router;
