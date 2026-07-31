const express = require("express");
const upload = require("../middleware/upload");
const {
  listSingers,
  getSinger,
  createSinger,
  updateSinger,
  deleteSinger,
} = require("../controllers/singer.controller");

const router = express.Router();

router.get("/", listSingers);
router.get("/:id", getSinger);
router.post("/", upload.single("avatar"), createSinger);
router.put("/:id", upload.single("avatar"), updateSinger);
router.delete("/:id", deleteSinger);

module.exports = router;
