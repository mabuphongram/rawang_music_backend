const express = require("express");
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
router.post("/", createSinger);
router.put("/:id", updateSinger);
router.delete("/:id", deleteSinger);

module.exports = router;
