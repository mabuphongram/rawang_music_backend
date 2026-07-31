const express = require("express");
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
router.post("/", createAlbum);
router.put("/:id", updateAlbum);
router.delete("/:id", deleteAlbum);

module.exports = router;
